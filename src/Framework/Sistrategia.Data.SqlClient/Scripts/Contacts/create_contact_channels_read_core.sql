-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_channels_read_core.sql
-- Created / Last Update: 2026-Sep-07. See ADR 0009 and ADR 0010.

-- Owns a short serializable read transaction: works without database SNAPSHOT configuration.
-- Reads the root first; writers retain that root's exclusive lock through outer commit.
-- No ambient transaction accepted (avoids mixing caller isolation/lifetimes).
-- Result sets: historical root/contact payload; emails at requested version; optional diff;
-- ordered email action evidence for the requested revision.
CREATE OR ALTER PROCEDURE [contacts].[contact_channels_read_core]
    @contact_public_key UNIQUEIDENTIFIER, @actor UNIQUEIDENTIFIER,
    @entity_version INT, @tenant UNIQUEIDENTIFIER=NULL, @compare_entity_version INT=NULL,
    @include_email BIT=1, @include_phone BIT=1, @include_web_link BIT=0, @include_address BIT=0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @@TRANCOUNT<>0
    BEGIN
        THROW 51400, 'Historical reader requires its own read transaction.', 1;
    END
    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @actor_id INT,@tenant_id INT,@contact_id INT,@bound BIGINT,@compare BIGINT,@root_stamp BIGINT;
        EXEC [entities].[actor_resolve]
            @actor = @actor,
            @tenant = @tenant,
            @actor_entity_id = @actor_id OUTPUT,
            @tenant_id = @tenant_id OUTPUT;
        SET @contact_id=(SELECT e.[entity_id] FROM [entities].[entity] e
            JOIN [contacts].[contact] c ON c.[contact_id]=e.[entity_id]
            WHERE e.[public_key]=@contact_public_key AND e.[tenant_id]=@tenant_id);
        IF @contact_id IS NULL
        BEGIN
            THROW 51202, 'Target contact does not exist in this tenant.', 1;
        END
        -- Lock the same clustered key as entity_write_lock, even if another index covers
        -- the identity lookup. Hold the shared barrier before reading any history.
        SET @root_stamp=(SELECT [dbrow_version] FROM [entities].[entity] WITH (HOLDLOCK,INDEX([px_entities_entity]))
            WHERE [entity_id]=@contact_id AND [tenant_id]=@tenant_id);
        IF @root_stamp IS NULL
        BEGIN
            THROW 51202, 'Target contact does not exist in this tenant.', 1;
        END
        SET @bound=(SELECT [dbrow_version] FROM [entities].[entity_version_history]
            WHERE [entity_id]=@contact_id AND [entity_version]=@entity_version AND [tenant_id]=@tenant_id);
        IF @bound IS NULL
        BEGIN
            THROW 51401, 'Requested entity revision does not exist.', 1;
        END
        IF @compare_entity_version IS NOT NULL
        BEGIN
            SET @compare=(SELECT [dbrow_version] FROM [entities].[entity_version_history]
                WHERE [entity_id]=@contact_id AND [entity_version]=@compare_entity_version AND [tenant_id]=@tenant_id);
            IF @compare IS NULL
            BEGIN
                THROW 51401, 'Comparison revision does not exist.', 1;
            END
        END;
        -- TOP(1)'s row goal can prefer a backwards global-clock scan even with a root index,
        -- taking ranges on unrelated roots. This locking reader requires root-leading seeks.
        IF NOT EXISTS (SELECT 1 FROM [entities].[entity_history] WITH (FORCESEEK,INDEX([ix_entity_history_root]))
            WHERE [entity_id]=@contact_id AND [dbrow_version]<=@bound)
            OR NOT EXISTS (SELECT 1 FROM [contacts].[contact_history] WITH (FORCESEEK,INDEX([ix_contact_history_root]))
                WHERE [contact_id]=@contact_id AND [dbrow_version]<=@bound)
        BEGIN
            THROW 51402, 'Historical root payload is unavailable for this revision.', 1;
        END
        SELECT @entity_version AS [entity_version],@bound AS [revision_dbrow_version],
            e.[display_name],e.[summary],e.[is_private],e.[deleted],c.[full_name],v.[recorded_at],v.[modified_by],e.[entity_type_id]
        FROM (SELECT TOP(1) * FROM [entities].[entity_history] WITH (FORCESEEK,INDEX([ix_entity_history_root]))
            WHERE [entity_id]=@contact_id AND [dbrow_version]<=@bound ORDER BY [dbrow_version] DESC) e
        CROSS JOIN (SELECT TOP(1) * FROM [contacts].[contact_history] WITH (FORCESEEK,INDEX([ix_contact_history_root]))
            WHERE [contact_id]=@contact_id AND [dbrow_version]<=@bound ORDER BY [dbrow_version] DESC) c
        JOIN [data].[dbrow_version] v ON v.[tenant_id]=@tenant_id AND v.[dbrow_version]=@bound;

        IF @include_email=1
        BEGIN
            EXEC [contacts].[contact_email_read_rows] @contact_id=@contact_id,@tenant_id=@tenant_id,@bound=@bound,@compare=@compare;
        END
        IF @include_phone=1
        BEGIN
            EXEC [contacts].[contact_phone_read_rows] @contact_id=@contact_id,@tenant_id=@tenant_id,@bound=@bound,@compare=@compare;
        END
        IF @include_web_link=1
        BEGIN
            EXEC [contacts].[contact_web_link_read_rows]
                @contact_id=@contact_id, @tenant_id=@tenant_id, @bound=@bound, @compare=@compare;
        END
        IF @include_address=1
        BEGIN
            EXEC [contacts].[contact_address_read_rows]
                @contact_id=@contact_id, @tenant_id=@tenant_id, @bound=@bound, @compare=@compare;
        END
        COMMIT;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK;
        THROW;
    END CATCH;
END;
