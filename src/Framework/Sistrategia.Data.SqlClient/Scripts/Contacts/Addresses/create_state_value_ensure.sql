-- Copyright (c) Sistrategia. All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_state_value_ensure.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0012.

CREATE OR ALTER PROCEDURE [contacts].[state_value_ensure]
    @name NVARCHAR(MAX),
    @country_id INT,
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
    IF @name IS NULL OR DATALENGTH(@name) NOT BETWEEN 2 AND 512 OR LEN(LTRIM(RTRIM(@name)))=0
    BEGIN
        THROW 51920, 'Geographic names must contain 1 to 256 UTF-16 units and cannot be blank.', 1;
    END
    SET @id=NULL;
    DECLARE @key VARBINARY(512)=CONVERT(VARBINARY(512),@name), @result INT, @timeout INT=@@LOCK_TIMEOUT;
    SELECT @id=[state_id] FROM [contacts].[state] WITH (FORCESEEK) WHERE [country_id]=@country_id AND [value_key]=@key AND [value_length]=DATALENGTH(@name);
    IF @id IS NULL
    BEGIN
        DECLARE @resource NVARCHAR(255)=N'overmind:address:state:'+COALESCE(CONVERT(NVARCHAR(11),@country_id),N'0')+N':'+CONVERT(NVARCHAR(64),HASHBYTES('SHA2_256',@key),2);
        EXEC @result=sys.sp_getapplock
            @Resource=@resource, @LockMode='Exclusive', @LockOwner='Transaction', @DbPrincipal='dbo', @LockTimeout=@timeout;
        IF @result<0
        BEGIN
            THROW 51912, 'Could not lock geographic value; roll back the unit.', 1;
        END
        SELECT @id=[state_id] FROM [contacts].[state] WITH (FORCESEEK) WHERE [country_id]=@country_id AND [value_key]=@key AND [value_length]=DATALENGTH(@name);
        IF @id IS NULL
        BEGIN
            INSERT [contacts].[state] ([state],[country_id]) VALUES (@name,@country_id);
            SET @id=CONVERT(INT,SCOPE_IDENTITY());
        END
    END
END;
