-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.

-- Script: create_audit_unit_assert.sql
-- Part of the Sistrategia.Core Framework.

-- Contributor(s):  J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
-- Last Update:     2025-Jul-14
-- Created:         2010-Sep-08
-- Version:         8.0.0.0

-- Discover this transaction's allocation without trusting SESSION_CONTEXT or client numbers.
-- A recovered/reused engine transaction ID cannot revive a released per-version lock.

CREATE OR ALTER PROCEDURE [data].[audit_unit_assert]
    @dbrow_version BIGINT = NULL OUTPUT
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;

    EXEC [data].[audit_isolation_assert];

    IF XACT_STATE() <> 1 
        THROW 51001, 'An active, committable audit transaction is required.', 1;

    DECLARE @tx BIGINT = CURRENT_TRANSACTION_ID()
    DECLARE @actual BIGINT = NULL;
    DECLARE @resource NVARCHAR(255) = N'overmind:unit:' + CONVERT(NVARCHAR(20), @tx);

    IF COALESCE(APPLOCK_MODE(N'dbo', @resource, N'Transaction'), N'NoLock') <> N'Exclusive'
    BEGIN
        THROW 51102, 'The ambient transaction is not enrolled. Call data.audit_unit_begin first.', 1;
    END

    SELECT @actual = [dbrow_version]
    FROM [data].[dbrow_version]
    WHERE [allocation_transaction_id] = @tx
      AND APPLOCK_MODE(N'dbo', N'overmind:version:' + CONVERT(NVARCHAR(20), [dbrow_version]), N'Transaction') = N'Exclusive';

    IF @dbrow_version IS NOT NULL AND (@actual IS NULL OR @actual <> @dbrow_version)
    BEGIN
        THROW 51103, 'The supplied audit version is not owned by this transaction and database.', 1;
    END

    SET @dbrow_version = @actual;
END;
