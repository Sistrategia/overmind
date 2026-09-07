-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_phone_values_ensure.sql
-- Created / Last Update: 2026-Sep-07. See ADR 0009 and ADR 0010.

-- Exact accepted UTF-16 bytes: case, accents and trailing spaces remain distinct.
-- Read-first on a hit; exact-value transaction lock on a miss, avoiding index-gap locks.
CREATE OR ALTER PROCEDURE [contacts].[phone_values_ensure]
    @phone_data NVARCHAR(MAX), @location_name NVARCHAR(MAX),
    @phone_id INT OUTPUT, @location_id INT OUTPUT, @input_id INT OUTPUT
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
    IF @phone_data IS NULL OR ISJSON(@phone_data)<>1 OR DATALENGTH(@phone_data)>4096
    BEGIN
        THROW 51700, 'Phone requires normalized JSON from the backend parser, at most 2048 UTF-16 units.', 1;
    END
    IF EXISTS (SELECT 1 FROM OPENJSON(@phone_data) GROUP BY [key] COLLATE Latin1_General_100_BIN2 HAVING COUNT(*)>1)
        OR EXISTS (SELECT 1 FROM OPENJSON(@phone_data) WHERE [type] NOT IN (0,1)
            OR [key] COLLATE Latin1_General_100_BIN2 NOT IN ('e164','country_calling_code','national_number',
                'raw_input','default_region','area_input','numbering_region','area_code','subscriber_number',
                'geographic_description','parser_version'))
    BEGIN
        THROW 51700, 'Phone interpretation requires unique recognized properties with string or null values.', 1;
    END
    DECLARE @e164 NVARCHAR(4000)=JSON_VALUE(@phone_data,'$.e164'),
        @cc NVARCHAR(4000)=JSON_VALUE(@phone_data,'$.country_calling_code'),
        @national NVARCHAR(4000)=JSON_VALUE(@phone_data,'$.national_number'),
        @raw NVARCHAR(4000)=JSON_VALUE(@phone_data,'$.raw_input'),
        @metadata NVARCHAR(4000)=JSON_VALUE(@phone_data,'$.parser_version'),
        @area NVARCHAR(4000)=JSON_VALUE(@phone_data,'$.area_code'),
        @subscriber NVARCHAR(4000)=JSON_VALUE(@phone_data,'$.subscriber_number');
    IF @e164 IS NULL OR @cc IS NULL OR @national IS NULL OR @raw IS NULL OR @metadata IS NULL
        OR DATALENGTH(@raw) NOT BETWEEN 2 AND 512 OR DATALENGTH(@metadata) NOT BETWEEN 2 AND 200
        OR DATALENGTH(@cc) NOT BETWEEN 2 AND 6 OR @cc COLLATE Latin1_General_100_BIN2 LIKE '%[^0-9]%'
        OR LEFT(@cc,1)='0' OR DATALENGTH(@national) NOT BETWEEN 2 AND 28
        OR @national COLLATE Latin1_General_100_BIN2 LIKE '%[^0-9]%'
        OR DATALENGTH(@e164)>32 OR @e164 COLLATE Latin1_General_100_BIN2<>'+'+@cc+@national
        OR DATALENGTH(@e164)<>2+DATALENGTH(@cc)+DATALENGTH(@national)
        OR DATALENGTH(JSON_VALUE(@phone_data,'$.numbering_region'))>6
        OR DATALENGTH(JSON_VALUE(@phone_data,'$.default_region'))>4
        OR DATALENGTH(JSON_VALUE(@phone_data,'$.area_input'))>30
        OR DATALENGTH(JSON_VALUE(@phone_data,'$.geographic_description'))>512
        OR (@area IS NULL AND @subscriber IS NOT NULL) OR (@area IS NOT NULL AND @subscriber IS NULL)
        OR (@area IS NOT NULL AND (DATALENGTH(@area)=0 OR @area COLLATE Latin1_General_100_BIN2 LIKE '%[^0-9]%'
            OR @subscriber COLLATE Latin1_General_100_BIN2 LIKE '%[^0-9]%' OR DATALENGTH(@subscriber)=0
            OR @area+@subscriber COLLATE Latin1_General_100_BIN2<>@national
            OR DATALENGTH(@area)+DATALENGTH(@subscriber)<>DATALENGTH(@national)))
    BEGIN
        THROW 51700, 'Normalized phone components are missing or inconsistent.', 1;
    END
    IF DATALENGTH(@location_name)>200
    BEGIN
        THROW 51701, 'Phone location exceeds 100 UTF-16 code units.', 1;
    END
    SET @phone_id=NULL; SET @location_id=NULL; SET @input_id=NULL;
    DECLARE @location_key VARBINARY(200)=CONVERT(VARBINARY(200),@location_name);
    DECLARE @resource NVARCHAR(255), @result INT, @timeout INT=@@LOCK_TIMEOUT;
    SELECT @phone_id=phone_id FROM contacts.phone WITH (FORCESEEK) WHERE e164=CONVERT(VARCHAR(16),@e164);
    IF @phone_id IS NULL
    BEGIN
        SET @resource=N'overmind:phone:value:'+@e164;
        EXEC @result=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@DbPrincipal='dbo',@LockTimeout=@timeout;
        IF @result<0
        BEGIN
            THROW 51712, 'Could not lock phone value; roll back the unit.', 1;
        END
        SELECT @phone_id=phone_id FROM contacts.phone WITH (FORCESEEK) WHERE e164=CONVERT(VARCHAR(16),@e164);
        IF @phone_id IS NULL
        BEGIN
            INSERT contacts.phone(e164,country_calling_code,national_number) VALUES (@e164,@cc,@national);
            SET @phone_id=CONVERT(INT,SCOPE_IDENTITY());
        END
    END
    IF NOT EXISTS (SELECT 1 FROM contacts.phone WHERE phone_id=@phone_id AND country_calling_code=@cc AND national_number=@national)
    BEGIN
        THROW 51700, 'Phone country/national split conflicts with the existing canonical number.', 1;
    END
    DECLARE @hash BINARY(32)=HASHBYTES('SHA2_256',CONVERT(VARBINARY(MAX),@phone_data));
    SELECT @input_id=input_id FROM contacts.phone_input WITH (FORCESEEK)
    WHERE value_hash=@hash AND value_length=DATALENGTH(@phone_data)
        AND CONVERT(VARBINARY(MAX),phone_data)=CONVERT(VARBINARY(MAX),@phone_data);
    IF @input_id IS NULL
    BEGIN
        SET @resource=N'overmind:phone:input:'+CONVERT(NVARCHAR(64),@hash,2);
        EXEC @result=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@DbPrincipal='dbo',@LockTimeout=@timeout;
        IF @result<0
        BEGIN
            THROW 51712, 'Could not lock phone input; roll back the unit.', 1;
        END
        SELECT @input_id=input_id FROM contacts.phone_input WITH (FORCESEEK)
        WHERE value_hash=@hash AND value_length=DATALENGTH(@phone_data)
            AND CONVERT(VARBINARY(MAX),phone_data)=CONVERT(VARBINARY(MAX),@phone_data);
        IF @input_id IS NULL
        BEGIN
            INSERT contacts.phone_input(phone_id,phone_data) VALUES (@phone_id,@phone_data);
            SET @input_id=CONVERT(INT,SCOPE_IDENTITY());
        END
    END
    IF @location_name IS NOT NULL
    BEGIN
        SELECT @location_id=[location_id] FROM [contacts].[phone_location] WHERE [value_key]=@location_key AND [value_length]=DATALENGTH(@location_name);
        IF @location_id IS NULL
        BEGIN
            SET @resource=N'overmind:phone:location:'+CONVERT(NVARCHAR(64),HASHBYTES('SHA2_256',@location_key),2);
            EXEC @result=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@DbPrincipal='dbo',@LockTimeout=@timeout;
            IF @result<0
            BEGIN
                THROW 51712, 'Could not lock the phone location; roll back the unit.',1;
            END
            SELECT @location_id=[location_id] FROM [contacts].[phone_location] WHERE [value_key]=@location_key AND [value_length]=DATALENGTH(@location_name);
            IF @location_id IS NULL
            BEGIN
                INSERT [contacts].[phone_location] ([location_name]) VALUES (@location_name);
                SET @location_id=CONVERT(INT,SCOPE_IDENTITY());
            END;
        END;
    END;
END;
