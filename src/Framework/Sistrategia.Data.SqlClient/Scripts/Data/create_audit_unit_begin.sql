-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.

-- Script: create_audit_unit_begin.sql
-- Part of the Sistrategia.Core Framework.

-- Contributor(s):  J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
-- Last Update:     2025-Jul-14
-- Created:         2010-Sep-08
-- Version:         8.0.0.0

-- Explicit enrollment of an existing transaction. Never begins/commits a transaction.
-- dbo application-lock namespace is private to owner-executed modules.
-- Requires an active committable caller transaction.

CREATE OR ALTER PROCEDURE [data].[audit_unit_begin]
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Ensure caller transaction meets isolation/assert requirements
    EXEC [data].[audit_isolation_assert];

    IF XACT_STATE() <> 1
        THROW 51100, 'Audit unit enrollment requires a committable caller transaction.', 1;

    DECLARE @resource NVARCHAR(255) = N'overmind:unit:' + CONVERT(NVARCHAR(20), CURRENT_TRANSACTION_ID());

    -- If already exclusively held by this transaction, we're done
    IF APPLOCK_MODE(N'dbo', @resource, N'Transaction') = N'Exclusive' 
        RETURN;

    DECLARE @result INT;

    EXEC @result = sys.sp_getapplock 
        @Resource=@resource, 
        @LockMode='Exclusive',
        @LockOwner='Transaction', 
        @DbPrincipal='dbo', 
        @LockTimeout=0
    ;

    IF @result < 0 
        THROW 51101, 'Could not enroll the audit unit.', 1;
END;