-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_person_name_value_ensure.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0013.

CREATE OR ALTER PROCEDURE [contacts].[person_name_value_ensure]
    @name NVARCHAR(MAX),
    @id INT OUTPUT
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC [data].[audit_isolation_assert];
    IF XACT_STATE()<>1
    BEGIN
        THROW 51001, 'Catalog writes require a committable transaction.', 1;
    END
    IF @name IS NULL OR DATALENGTH(@name)>512
    BEGIN
        THROW 52001, 'Person names must contain at most 256 UTF-16 units.', 1;
    END
    SET @id=NULL;
    DECLARE @key VARBINARY(512)=CONVERT(VARBINARY(512),@name), @result INT, @timeout INT=@@LOCK_TIMEOUT;
    SELECT @id=[person_name_id] FROM [contacts].[person_name] WITH (FORCESEEK) WHERE [value_key]=@key AND [value_length]=DATALENGTH(@name);
    IF @id IS NULL
    BEGIN
        DECLARE @resource NVARCHAR(255)=N'overmind:person-name:'+CONVERT(NVARCHAR(64),HASHBYTES('SHA2_256',@key),2);
        EXEC @result=sys.sp_getapplock
            @Resource=@resource, @LockMode='Exclusive', @LockOwner='Transaction', @DbPrincipal='dbo', @LockTimeout=@timeout;
        IF @result<0
        BEGIN
            THROW 52012, 'Could not lock person-name value; roll back the unit.', 1;
        END
        SELECT @id=[person_name_id] FROM [contacts].[person_name] WITH (FORCESEEK) WHERE [value_key]=@key AND [value_length]=DATALENGTH(@name);
        IF @id IS NULL
        BEGIN
            INSERT [contacts].[person_name] ([name]) VALUES (@name);
            SET @id=CONVERT(INT,SCOPE_IDENTITY());
        END
    END
END;
