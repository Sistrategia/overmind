-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.

-- Script: create_contact_company_lookup.sql
-- Part of the Sistrategia.Contacts Framework.
-- Last Update: 2026-Sep-07
-- Created: 2026-Sep-07
-- Version: 8.0.0.0

-- Private lookup for the legacy company-name construction convenience.
-- A miss retains transaction-owned protection until contact_insert creates the company.
-- Company names retain database-collation equality; they are not unique business identities.
CREATE OR ALTER PROCEDURE [contacts].[contact_company_lookup]
    @tenant_id INT,
    @company_name NVARCHAR(256),
    @company_contact_id INT OUTPUT
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @company_contact_id = NULL;
    DECLARE @dbrow_version BIGINT;
    EXEC [data].[audit_unit_assert] @dbrow_version OUTPUT;

    IF @company_name IS NULL OR NOT EXISTS (
        SELECT 1
        FROM [data].[dbrow_version]
        WHERE [dbrow_version] = @dbrow_version AND [tenant_id] = @tenant_id
    )
    BEGIN
        THROW 51314, 'Company lookup requires a name and this tenant''s allocated audit unit.', 1;
    END

    -- Fresh DDL inherits the database collation. Refuse collation drift rather than lock
    -- by one equivalence relation and look up by another after an unsupported schema change.
    IF NOT EXISTS (
        SELECT 1
        FROM sys.columns
        WHERE [object_id] = OBJECT_ID(N'contacts.contact') AND [name] = N'full_name'
            AND [collation_name] = CONVERT(NVARCHAR(128), DATABASEPROPERTYEX(DB_NAME(), 'Collation'))
    )
    BEGIN
        THROW 51316, 'Company lookup requires full_name to use the database collation.', 1;
    END

    DECLARE @matches INT;
    SELECT @matches = COUNT(*), @company_contact_id = MIN(c.[contact_id])
    FROM [contacts].[contact] c WITH (INDEX([ix_contact_company_name]), FORCESEEK)
    JOIN [entities].[entity] e WITH (FORCESEEK) ON e.[entity_id] = c.[contact_id]
    WHERE c.[contact_type_id] = 2 AND c.[full_name] = @company_name AND e.[tenant_id] = @tenant_id;

    IF @matches = 0
    BEGIN
        -- CHECKSUM respects equality for the same type/collation, including trailing spaces.
        -- This is ONLY a lock bucket: collisions cause waiting, never value equivalence.
        -- Keep the full name predicate on every lookup. Do not replace this with a byte hash.
        DECLARE @resource NVARCHAR(255) = N'overmind:company:name:'
            + CONVERT(NVARCHAR(20), @tenant_id) + N':'
            + CONVERT(NVARCHAR(20), CHECKSUM(@company_name COLLATE DATABASE_DEFAULT));
        DECLARE @result INT;
        DECLARE @timeout INT = @@LOCK_TIMEOUT;

        EXEC @result = sys.sp_getapplock
            @Resource = @resource,
            @LockMode = 'Exclusive',
            @LockOwner = 'Transaction',
            @DbPrincipal = 'dbo',
            @LockTimeout = @timeout
        ;

        IF @result < 0
        BEGIN
            THROW 51315, 'Could not lock the company name; roll back the audit unit.', 1;
        END

        SELECT @matches = COUNT(*), @company_contact_id = MIN(c.[contact_id])
        FROM [contacts].[contact] c WITH (INDEX([ix_contact_company_name]), FORCESEEK)
        JOIN [entities].[entity] e WITH (FORCESEEK) ON e.[entity_id] = c.[contact_id]
        WHERE c.[contact_type_id] = 2 AND c.[full_name] = @company_name AND e.[tenant_id] = @tenant_id;
    END

    IF @matches > 1
    BEGIN
        THROW 51313, 'Company name is ambiguous within this tenant; select a company explicitly.', 1;
    END
END;
