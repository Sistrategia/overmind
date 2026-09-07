-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.

-- Script: create_audit_isolation_assert.sql
-- Part of the Sistrategia.Core Framework.

-- Contributor(s):  J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
-- Last Update:     2026-Sep-06
-- Created:         2026-Sep-05
-- Version:         8.0.0.0

-- The native writer profile uses statement-consistent READ COMMITTED, with or without RCSI.
-- Rechecked on every ownership assertion, so changing isolation after enrollment is rejected.

CREATE OR ALTER PROCEDURE [data].[audit_isolation_assert]
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;

    IF COALESCE((
        SELECT [transaction_isolation_level]
        FROM sys.dm_exec_sessions
        WHERE [session_id] = @@SPID
    ), 0) <> 2
    BEGIN
        THROW 51106, 'Audit writes require READ COMMITTED isolation (RCSI may be enabled).', 1;
    END
END;
