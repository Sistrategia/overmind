-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.

-- Script: create_tenant_insert.sql
-- Part of the Sistrategia.Core Framework.

-- Contributor(s):  J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
-- Last Update:     2026-Sep-06
-- Created:         2026-Aug-03
-- Version:         8.0.0.0

-- Trusted administrative constructor. The caller resolves/authorizes the actor in its own layer.
-- Kept separate from ordinary email commands; no application EXECUTE grant.

CREATE OR ALTER PROCEDURE [data].[tenant_insert]
    @name NVARCHAR(256),
    @public_key UNIQUEIDENTIFIER = NULL,
    @created DATETIME2 = NULL,
    @actor_entity_id INT,
    @tenant_id INT = NULL OUTPUT,
    @dbrow_version BIGINT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @owns BIT = 0;

    BEGIN TRY
        IF @dbrow_version IS NOT NULL AND @@TRANCOUNT = 0
        BEGIN
            THROW 51008, 'A supplied version requires an enrolled transaction.', 1;
        END

        -- Enroll a new transaction only when this procedure owns it
        IF @@TRANCOUNT = 0
        BEGIN
            BEGIN TRANSACTION;
            SET @owns = 1;

            EXEC [data].[audit_unit_begin];
        END

        EXEC [data].[audit_unit_assert] @dbrow_version OUTPUT;

        IF @dbrow_version IS NOT NULL
        BEGIN
            THROW 51503, 'Tenant creation requires a separate audit unit.', 1;
        END

        IF @public_key IS NULL
        BEGIN
            SET @public_key = NEWID();
        END

        IF @created IS NULL
        BEGIN
            SET @created = SYSUTCDATETIME();
        END

        INSERT [data].[tenant] (
            [public_key],
            [name]
        )
        VALUES (
            @public_key,
            @name
        );

        SET @tenant_id = CONVERT(INT, SCOPE_IDENTITY());

        EXEC [data].[dbrow_version_ensure]
            @tenant_id = @tenant_id,
            @actor_entity_id = @actor_entity_id,
            @dboperation_type_id = 1,
            @modified = @created,
            @dbrow_version = @dbrow_version OUTPUT
        ;

        IF @owns = 1
        BEGIN
            COMMIT;
        END
    END TRY
    BEGIN CATCH
        IF @owns = 1 AND XACT_STATE() <> 0
        BEGIN
            ROLLBACK;
        END

        SET @tenant_id = NULL;
        SET @dbrow_version = NULL;

        THROW;
    END CATCH;
END;
