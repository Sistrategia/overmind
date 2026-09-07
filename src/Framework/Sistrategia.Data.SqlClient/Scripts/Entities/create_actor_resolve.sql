-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.

-- Script: create_actor_resolve.sql
-- Part of the Sistrategia.Core Framework.
-- Last Update: 2026-Sep-07
-- Created: 2026-Sep-05
-- Version: 8.0.0.0

-- Identity/scope validation only: the trusted application authenticates and authorizes its caller.
-- Ordinary writes currently support active user actors within their own tenant.
-- No implicit System, is_system, or cross-tenant bypass; platform delegation is a separate API.
CREATE OR ALTER PROCEDURE [entities].[actor_resolve]
    @actor UNIQUEIDENTIFIER,
    @tenant UNIQUEIDENTIFIER = NULL,
    @actor_entity_id INT OUTPUT,
    @tenant_id INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    SET @actor_entity_id = NULL;
    SET @tenant_id = NULL;

    IF @tenant IS NULL
    BEGIN
        SET @tenant = '908E5A8C-0372-4EDC-ADDF-011E059091ED';
    END

    SET @tenant_id = (SELECT [tenant_id] FROM [data].[tenant] WHERE [public_key] = @tenant);
    IF @tenant_id IS NULL
    BEGIN
        THROW 51200, 'Unknown target tenant.', 1;
    END

    -- An actor lookup must not scan and wait on unrelated provisional user roots.
    -- Still read the actual actor's lifecycle/tenant state through its clustered lookup.
    SELECT @actor_entity_id = e.[entity_id]
    FROM [entities].[entity] e WITH (INDEX([uqc_entities_entity_public_key]), FORCESEEK)
    JOIN [entities].[entity_type] t ON t.[entity_type_id] = e.[entity_type_id]
    WHERE e.[public_key] = @actor AND e.[tenant_id] = @tenant_id AND t.[code_name] = N'user'
      AND e.[deleted] IS NULL AND e.[locked] IS NULL;

    IF @actor_entity_id IS NULL
    BEGIN
        THROW 51201, 'An active user actor authorized for this tenant is required.', 1;
    END
END;
