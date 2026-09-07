-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_web_link_values_ensure.sql
-- Created / Last Update: 2026-Sep-07. See ADR 0011.
-- Version: 8.0.0.0.

-- Exact accepted UTF-16 bytes: case, accents and trailing spaces remain distinct.
-- Read-first on a hit; exact-value transaction lock on a miss, avoiding index-gap locks.
CREATE OR ALTER PROCEDURE [contacts].[web_link_values_ensure]
    @url NVARCHAR(MAX),
    @location_name NVARCHAR(MAX),
    @web_link_id INT OUTPUT,
    @location_id INT OUTPUT
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC [data].[audit_isolation_assert];
    IF XACT_STATE() <> 1
    BEGIN
        THROW 51001, 'Catalog writes require a committable transaction.', 1;
    END
    IF @url IS NULL OR DATALENGTH(@url)=0 OR DATALENGTH(@url)>4096
    BEGIN
        THROW 51800, 'Web link must contain 1 to 2048 UTF-16 code units.', 1;
    END
    IF DATALENGTH(@location_name)>200
    BEGIN
        THROW 51801, 'Web link location exceeds 100 UTF-16 code units.', 1;
    END
    -- Native adapters must also perform URI parsing (WebLinkInput.Validate). No trimming or rewriting.
    DECLARE @scheme_end INT=CHARINDEX(N'://',@url), @authority NVARCHAR(2048), @tail NVARCHAR(2048);
    IF @scheme_end NOT IN (5,6) OR LOWER(LEFT(@url,@scheme_end-1)) NOT IN (N'http',N'https')
    BEGIN
        THROW 51800, 'Web links require an absolute HTTP or HTTPS URL.', 1;
    END
    SET @tail=SUBSTRING(@url,@scheme_end+3,2048);
    SET @authority=LEFT(@tail,PATINDEX(N'%[/?#]%',@tail+N'/')-1);
    IF DATALENGTH(@authority)=0 OR CHARINDEX(N'@',@authority)>0 OR CHARINDEX(N'\',@url)>0
    BEGIN
        THROW 51800, 'Web links require a host and cannot contain credentials or backslashes.', 1;
    END
    DECLARE @offset INT=1, @code INT;
    WHILE @offset<=DATALENGTH(@url)/2
    BEGIN
        SET @code=UNICODE(SUBSTRING(@url COLLATE Latin1_General_100_BIN2,@offset,1));
        IF @code<=32 OR @code BETWEEN 127 AND 160 OR @code IN (5760,8232,8233,8239,8287,12288)
            OR @code BETWEEN 8192 AND 8202
        BEGIN
            THROW 51800, 'URL whitespace and controls must be explicitly encoded.', 1;
        END
        IF @code=37 AND (DATALENGTH(SUBSTRING(@url,@offset+1,2))<>4
            OR SUBSTRING(@url,@offset+1,2) COLLATE Latin1_General_100_BIN2 LIKE N'%[^0-9a-fA-F]%')
        BEGIN
            THROW 51800, 'URL percent escapes must contain two hexadecimal digits.', 1;
        END
        SET @offset+=1;
    END
    SET @web_link_id = NULL; SET @location_id = NULL;
    DECLARE @web_link_key VARBINARY(4096)=CONVERT(VARBINARY(4096),@url),
        @location_key VARBINARY(200)=CONVERT(VARBINARY(200),@location_name);
    DECLARE @hash BINARY(32)=HASHBYTES('SHA2_256',@web_link_key);
    DECLARE @resource NVARCHAR(255), @result INT, @timeout INT=@@LOCK_TIMEOUT;
    SELECT @web_link_id=[web_link_id] FROM [contacts].[web_link] WITH (FORCESEEK) WHERE [value_hash]=@hash AND [value_length]=DATALENGTH(@url)
        AND CONVERT(VARBINARY(MAX),[url])=@web_link_key;
    IF @web_link_id IS NULL
    BEGIN
        SET @resource=N'overmind:web_link:value:'+CONVERT(NVARCHAR(64),HASHBYTES('SHA2_256',@web_link_key),2);
        EXEC @result=sys.sp_getapplock
            @Resource = @resource,
            @LockMode = 'Exclusive',
            @LockOwner = 'Transaction',
            @DbPrincipal = 'dbo',
            @LockTimeout = @timeout;
        IF @result<0
        BEGIN
            THROW 51812, 'Could not lock the web link value; roll back the unit.',1;
        END
        SELECT @web_link_id=[web_link_id] FROM [contacts].[web_link] WITH (FORCESEEK) WHERE [value_hash]=@hash AND [value_length]=DATALENGTH(@url)
        AND CONVERT(VARBINARY(MAX),[url])=@web_link_key;
        IF @web_link_id IS NULL
        BEGIN
            INSERT [contacts].[web_link] ([url]) VALUES (@url);
            SET @web_link_id=CONVERT(INT,SCOPE_IDENTITY());
        END;
    END;
    IF @location_name IS NOT NULL
    BEGIN
        SELECT @location_id=[location_id] FROM [contacts].[web_link_location] WHERE [value_key]=@location_key AND [value_length]=DATALENGTH(@location_name);
        IF @location_id IS NULL
        BEGIN
            SET @resource=N'overmind:web_link:location:'+CONVERT(NVARCHAR(64),HASHBYTES('SHA2_256',@location_key),2);
            EXEC @result=sys.sp_getapplock
                @Resource = @resource,
                @LockMode = 'Exclusive',
                @LockOwner = 'Transaction',
                @DbPrincipal = 'dbo',
                @LockTimeout = @timeout;
            IF @result<0
            BEGIN
                THROW 51812, 'Could not lock the web link location; roll back the unit.',1;
            END
            SELECT @location_id=[location_id] FROM [contacts].[web_link_location] WHERE [value_key]=@location_key AND [value_length]=DATALENGTH(@location_name);
            IF @location_id IS NULL
            BEGIN
                INSERT [contacts].[web_link_location] ([location_name]) VALUES (@location_name);
                SET @location_id=CONVERT(INT,SCOPE_IDENTITY());
            END;
        END;
    END;
END;
