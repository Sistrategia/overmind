-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_address_values_ensure.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0012.

CREATE OR ALTER PROCEDURE [contacts].[address_values_ensure]
    @address_data NVARCHAR(MAX),
    @location_name NVARCHAR(MAX),
    @address_id INT OUTPUT,
    @location_id INT OUTPUT
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC [data].[audit_isolation_assert];
    IF XACT_STATE()<>1
    BEGIN
        THROW 51001, 'Address values require a committable transaction.', 1;
    END
    SET @address_id=NULL;
    SET @location_id=NULL;
    IF @address_data IS NULL OR DATALENGTH(@address_data)>32768 OR ISJSON(@address_data,OBJECT)<>1
    BEGIN
        THROW 51900, 'Supply a JSON address object of at most 16384 UTF-16 units.', 1;
    END
    DECLARE @input TABLE ([key] NVARCHAR(4000) COLLATE Latin1_General_100_BIN2, [value] NVARCHAR(MAX), [type] INT);
    INSERT @input SELECT [key],[value],[type] FROM OPENJSON(@address_data);
    IF EXISTS (SELECT 1 FROM @input WHERE [key] NOT IN (N'address1',N'address2',N'street_name',N'ext_number',N'int_number',N'zip_code',N'references',N'country_id',N'state_id',N'county_id',N'city_id',N'colony_id',N'country',N'state',N'county',N'city',N'colony'))
        OR EXISTS (SELECT 1 FROM @input WHERE DATALENGTH([key])<>DATALENGTH(RTRIM([key])))
        OR EXISTS (SELECT 1 FROM @input GROUP BY [key] HAVING COUNT(*)>1)
        OR EXISTS (SELECT 1 FROM @input WHERE [type] NOT IN (0,1,2)
            OR ([key] IN (N'country_id',N'state_id',N'county_id',N'city_id',N'colony_id') AND [type] NOT IN (0,2))
            OR ([key] NOT IN (N'country_id',N'state_id',N'county_id',N'city_id',N'colony_id') AND [type] NOT IN (0,1)))
    BEGIN
        THROW 51900, 'Address properties must be recognized, unique and correctly typed.', 1;
    END
    DECLARE @address1 NVARCHAR(MAX)=(SELECT [value] FROM @input WHERE [key]=N'address1');
    IF DATALENGTH(@address1)>512
    BEGIN
        THROW 51900, 'Address field exceeds its declared width: address1.', 1;
    END
    DECLARE @address2 NVARCHAR(MAX)=(SELECT [value] FROM @input WHERE [key]=N'address2');
    IF DATALENGTH(@address2)>512
    BEGIN
        THROW 51900, 'Address field exceeds its declared width: address2.', 1;
    END
    DECLARE @street_name NVARCHAR(MAX)=(SELECT [value] FROM @input WHERE [key]=N'street_name');
    IF DATALENGTH(@street_name)>512
    BEGIN
        THROW 51900, 'Address field exceeds its declared width: street_name.', 1;
    END
    DECLARE @ext_number NVARCHAR(MAX)=(SELECT [value] FROM @input WHERE [key]=N'ext_number');
    IF DATALENGTH(@ext_number)>50
    BEGIN
        THROW 51900, 'Address field exceeds its declared width: ext_number.', 1;
    END
    DECLARE @int_number NVARCHAR(MAX)=(SELECT [value] FROM @input WHERE [key]=N'int_number');
    IF DATALENGTH(@int_number)>50
    BEGIN
        THROW 51900, 'Address field exceeds its declared width: int_number.', 1;
    END
    DECLARE @zip_code NVARCHAR(MAX)=(SELECT [value] FROM @input WHERE [key]=N'zip_code');
    IF DATALENGTH(@zip_code)>64
    BEGIN
        THROW 51900, 'Address field exceeds its declared width: zip_code.', 1;
    END
    DECLARE @references NVARCHAR(MAX)=(SELECT [value] FROM @input WHERE [key]=N'references');
    IF DATALENGTH(@references)>512
    BEGIN
        THROW 51900, 'Address field exceeds its declared width: references.', 1;
    END
    DECLARE @country NVARCHAR(MAX)=(SELECT [value] FROM @input WHERE [key]=N'country');
    IF DATALENGTH(@country)>512
    BEGIN
        THROW 51900, 'Address field exceeds its declared width: country.', 1;
    END
    DECLARE @state NVARCHAR(MAX)=(SELECT [value] FROM @input WHERE [key]=N'state');
    IF DATALENGTH(@state)>512
    BEGIN
        THROW 51900, 'Address field exceeds its declared width: state.', 1;
    END
    DECLARE @county NVARCHAR(MAX)=(SELECT [value] FROM @input WHERE [key]=N'county');
    IF DATALENGTH(@county)>512
    BEGIN
        THROW 51900, 'Address field exceeds its declared width: county.', 1;
    END
    DECLARE @city NVARCHAR(MAX)=(SELECT [value] FROM @input WHERE [key]=N'city');
    IF DATALENGTH(@city)>512
    BEGIN
        THROW 51900, 'Address field exceeds its declared width: city.', 1;
    END
    DECLARE @colony NVARCHAR(MAX)=(SELECT [value] FROM @input WHERE [key]=N'colony');
    IF DATALENGTH(@colony)>512
    BEGIN
        THROW 51900, 'Address field exceeds its declared width: colony.', 1;
    END
    DECLARE @country_id INT=TRY_CONVERT(INT,(SELECT [value] FROM @input WHERE [key]=N'country_id'));
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'country_id' AND [type]<>0
        AND (@country_id IS NULL OR @country_id<=0 OR [value] COLLATE Latin1_General_100_BIN2 LIKE N'%[^0-9]%'))
    BEGIN
        THROW 51921, 'Explicit geographic IDs must be positive integers.', 1;
    END
    DECLARE @state_id INT=TRY_CONVERT(INT,(SELECT [value] FROM @input WHERE [key]=N'state_id'));
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'state_id' AND [type]<>0
        AND (@state_id IS NULL OR @state_id<=0 OR [value] COLLATE Latin1_General_100_BIN2 LIKE N'%[^0-9]%'))
    BEGIN
        THROW 51921, 'Explicit geographic IDs must be positive integers.', 1;
    END
    DECLARE @county_id INT=TRY_CONVERT(INT,(SELECT [value] FROM @input WHERE [key]=N'county_id'));
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'county_id' AND [type]<>0
        AND (@county_id IS NULL OR @county_id<=0 OR [value] COLLATE Latin1_General_100_BIN2 LIKE N'%[^0-9]%'))
    BEGIN
        THROW 51921, 'Explicit geographic IDs must be positive integers.', 1;
    END
    DECLARE @city_id INT=TRY_CONVERT(INT,(SELECT [value] FROM @input WHERE [key]=N'city_id'));
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'city_id' AND [type]<>0
        AND (@city_id IS NULL OR @city_id<=0 OR [value] COLLATE Latin1_General_100_BIN2 LIKE N'%[^0-9]%'))
    BEGIN
        THROW 51921, 'Explicit geographic IDs must be positive integers.', 1;
    END
    DECLARE @colony_id INT=TRY_CONVERT(INT,(SELECT [value] FROM @input WHERE [key]=N'colony_id'));
    IF EXISTS (SELECT 1 FROM @input WHERE [key]=N'colony_id' AND [type]<>0
        AND (@colony_id IS NULL OR @colony_id<=0 OR [value] COLLATE Latin1_General_100_BIN2 LIKE N'%[^0-9]%'))
    BEGIN
        THROW 51921, 'Explicit geographic IDs must be positive integers.', 1;
    END
    IF ((@address1 IS NOT NULL OR @address2 IS NOT NULL)
        AND (@street_name IS NOT NULL OR @ext_number IS NOT NULL OR @int_number IS NOT NULL))
        OR ((@ext_number IS NOT NULL OR @int_number IS NOT NULL) AND NULLIF(LTRIM(RTRIM(@street_name)),N'') IS NULL)
    BEGIN
        THROW 51923, 'Use address lines or structured street/number fields; numbers require a street.', 1;
    END
    IF DATALENGTH(@location_name)>200
    BEGIN
        THROW 51901, 'Address label exceeds 100 UTF-16 units.', 1;
    END
    EXEC [contacts].[address_geography_resolve]
        @country_id = @country_id OUTPUT,
        @country = @country,
        @state_id = @state_id OUTPUT,
        @state = @state,
        @county_id = @county_id OUTPUT,
        @county = @county,
        @city_id = @city_id OUTPUT,
        @city = @city,
        @colony_id = @colony_id OUTPUT,
        @colony = @colony;
    IF NULLIF(LTRIM(RTRIM(@address1)),N'') IS NULL AND NULLIF(LTRIM(RTRIM(@address2)),N'') IS NULL AND NULLIF(LTRIM(RTRIM(@street_name)),N'') IS NULL AND NULLIF(LTRIM(RTRIM(@zip_code)),N'') IS NULL
        AND @country_id IS NULL AND @state_id IS NULL AND @county_id IS NULL AND @city_id IS NULL AND @colony_id IS NULL
    BEGIN
        THROW 51900, 'An address requires at least one postal component or geographic reference.', 1;
    END
    DECLARE @key VARBINARY(4096)=CONVERT(VARBINARY(4096),CONCAT(
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH(@address1))+N':'+@address1,N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH(@address2))+N':'+@address2,N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH(@street_name))+N':'+@street_name,N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH(@ext_number))+N':'+@ext_number,N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH(@int_number))+N':'+@int_number,N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH(@zip_code))+N':'+@zip_code,N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH(@references))+N':'+@references,N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH(CONVERT(NVARCHAR(11),@country_id)))+N':'+CONVERT(NVARCHAR(11),@country_id),N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH(CONVERT(NVARCHAR(11),@state_id)))+N':'+CONVERT(NVARCHAR(11),@state_id),N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH(CONVERT(NVARCHAR(11),@county_id)))+N':'+CONVERT(NVARCHAR(11),@county_id),N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH(CONVERT(NVARCHAR(11),@city_id)))+N':'+CONVERT(NVARCHAR(11),@city_id),N'-1:'),
        COALESCE(CONVERT(NVARCHAR(MAX),DATALENGTH(CONVERT(NVARCHAR(11),@colony_id)))+N':'+CONVERT(NVARCHAR(11),@colony_id),N'-1:')));
    DECLARE @hash BINARY(32)=HASHBYTES('SHA2_256',@key), @resource NVARCHAR(255), @result INT, @timeout INT=@@LOCK_TIMEOUT;
    SELECT @address_id=[address_id] FROM [contacts].[address] WITH (FORCESEEK)
    WHERE [value_hash]=@hash AND [value_key]=@key AND DATALENGTH([value_key])=DATALENGTH(@key);
    IF @address_id IS NULL
    BEGIN
        SET @resource=N'overmind:address:value:'+CONVERT(NVARCHAR(64),@hash,2);
        EXEC @result=sys.sp_getapplock
            @Resource=@resource, @LockMode='Exclusive', @LockOwner='Transaction', @DbPrincipal='dbo', @LockTimeout=@timeout;
        IF @result<0
        BEGIN
            THROW 51912, 'Could not lock address value; roll back the unit.', 1;
        END
        SELECT @address_id=[address_id] FROM [contacts].[address] WITH (FORCESEEK)
        WHERE [value_hash]=@hash AND [value_key]=@key AND DATALENGTH([value_key])=DATALENGTH(@key);
        IF @address_id IS NULL
        BEGIN
            INSERT [contacts].[address] ([address1],[address2],[street_name],[ext_number],[int_number],[zip_code],[references],[country_id],[state_id],[county_id],[city_id],[colony_id],[value_hash])
            VALUES (@address1,@address2,@street_name,@ext_number,@int_number,@zip_code,@references,@country_id,@state_id,@county_id,@city_id,@colony_id,@hash);
            SET @address_id=CONVERT(INT,SCOPE_IDENTITY());
        END
    END
    DECLARE @location_key VARBINARY(200)=CONVERT(VARBINARY(200),@location_name);
    IF @location_name IS NOT NULL
    BEGIN
        SELECT @location_id=[location_id] FROM [contacts].[address_location] WHERE [value_key]=@location_key AND [value_length]=DATALENGTH(@location_name);
        IF @location_id IS NULL
        BEGIN
            SET @resource=N'overmind:address:location:'+CONVERT(NVARCHAR(64),HASHBYTES('SHA2_256',@location_key),2);
            EXEC @result=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@DbPrincipal='dbo',@LockTimeout=@timeout;
            IF @result<0
            BEGIN
                THROW 51912, 'Could not lock address label; roll back the unit.',1;
            END
            SELECT @location_id=[location_id] FROM [contacts].[address_location] WHERE [value_key]=@location_key AND [value_length]=DATALENGTH(@location_name);
            IF @location_id IS NULL
            BEGIN
                INSERT [contacts].[address_location] ([location_name]) VALUES (@location_name);
                SET @location_id=CONVERT(INT,SCOPE_IDENTITY());
            END;
        END;
    END;
END;
