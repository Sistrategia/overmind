-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.

-- Script: create_audit_action_next.sql
-- Part of the Sistrategia.Core Framework.

-- Contributor(s):  J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
-- Last Update:     2026-Sep-06
-- Created:         2026-Sep-05
-- Version:         8.0.0.0

-- Advance and return the action ordinal within this enrolled audit unit.
-- The counter update and returned value belong to the same atomic statement.

CREATE OR ALTER PROCEDURE [data].[audit_action_next]
    @tenant_id INT,
    @dbrow_version BIGINT,
    @action_ordinal INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC [data].[audit_unit_assert] @dbrow_version OUTPUT;

    SET @action_ordinal = NULL;

    UPDATE [data].[dbrow_version]
    SET @action_ordinal = [last_action_ordinal] = [last_action_ordinal] + 1
    WHERE [tenant_id] = @tenant_id
      AND [dbrow_version] = @dbrow_version;

    IF @action_ordinal IS NULL
    BEGIN
        THROW 51105, 'Action does not belong to this audit unit.', 1;
    END
END;
