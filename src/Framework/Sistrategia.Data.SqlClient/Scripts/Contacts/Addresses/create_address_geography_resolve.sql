-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_address_geography_resolve.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0012.

CREATE OR ALTER PROCEDURE [contacts].[address_geography_resolve]
    @country_id INT=NULL OUTPUT,
    @country NVARCHAR(MAX)=NULL,
    @state_id INT=NULL OUTPUT,
    @state NVARCHAR(MAX)=NULL,
    @county_id INT=NULL OUTPUT,
    @county NVARCHAR(MAX)=NULL,
    @city_id INT=NULL OUTPUT,
    @city NVARCHAR(MAX)=NULL,
    @colony_id INT=NULL OUTPUT,
    @colony NVARCHAR(MAX)=NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @country_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [contacts].[country] WHERE [country_id]=@country_id)
    BEGIN
        THROW 51921, 'An explicit geographic ID does not exist.', 1;
    END
    IF @state_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [contacts].[state] WHERE [state_id]=@state_id)
    BEGIN
        THROW 51921, 'An explicit geographic ID does not exist.', 1;
    END
    IF @county_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [contacts].[county] WHERE [county_id]=@county_id)
    BEGIN
        THROW 51921, 'An explicit geographic ID does not exist.', 1;
    END
    IF @city_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [contacts].[city] WHERE [city_id]=@city_id)
    BEGIN
        THROW 51921, 'An explicit geographic ID does not exist.', 1;
    END
    IF @colony_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [contacts].[colony] WHERE [colony_id]=@colony_id)
    BEGIN
        THROW 51921, 'An explicit geographic ID does not exist.', 1;
    END
    IF @colony_id IS NOT NULL
    BEGIN
        DECLARE @colony_city INT=(SELECT [city_id] FROM [contacts].[colony] WHERE [colony_id]=@colony_id);
        IF @city_id IS NOT NULL AND (@colony_city IS NULL OR @city_id<>@colony_city)
        BEGIN
            THROW 51921, 'Geographic IDs have contradictory parent context.', 1;
        END
        SET @city_id=@colony_city;
    END
    IF @city_id IS NOT NULL
    BEGIN
        DECLARE @city_state INT=(SELECT [state_id] FROM [contacts].[city] WHERE [city_id]=@city_id);
        IF @state_id IS NOT NULL AND (@city_state IS NULL OR @state_id<>@city_state)
        BEGIN
            THROW 51921, 'Geographic IDs have contradictory parent context.', 1;
        END
        SET @state_id=@city_state;
    END
    IF @city_id IS NOT NULL
    BEGIN
        DECLARE @city_country INT=(SELECT [country_id] FROM [contacts].[city] WHERE [city_id]=@city_id);
        IF @country_id IS NOT NULL AND (@city_country IS NULL OR @country_id<>@city_country)
        BEGIN
            THROW 51921, 'Geographic IDs have contradictory parent context.', 1;
        END
        SET @country_id=@city_country;
    END
    IF @county_id IS NOT NULL
    BEGIN
        DECLARE @county_state INT=(SELECT [state_id] FROM [contacts].[county] WHERE [county_id]=@county_id);
        IF @state_id IS NOT NULL AND (@county_state IS NULL OR @state_id<>@county_state)
        BEGIN
            THROW 51921, 'Geographic IDs have contradictory parent context.', 1;
        END
        SET @state_id=@county_state;
    END
    IF @county_id IS NOT NULL
    BEGIN
        DECLARE @county_country INT=(SELECT [country_id] FROM [contacts].[county] WHERE [county_id]=@county_id);
        IF @country_id IS NOT NULL AND (@county_country IS NULL OR @country_id<>@county_country)
        BEGIN
            THROW 51921, 'Geographic IDs have contradictory parent context.', 1;
        END
        SET @country_id=@county_country;
    END
    IF @state_id IS NOT NULL
    BEGIN
        DECLARE @state_country INT=(SELECT [country_id] FROM [contacts].[state] WHERE [state_id]=@state_id);
        IF @country_id IS NOT NULL AND (@state_country IS NULL OR @country_id<>@state_country)
        BEGIN
            THROW 51921, 'Geographic IDs have contradictory parent context.', 1;
        END
        SET @country_id=@state_country;
    END
    IF @country IS NOT NULL
    BEGIN
        IF DATALENGTH(@country) NOT BETWEEN 2 AND 512 OR LEN(LTRIM(RTRIM(@country)))=0
        BEGIN
            THROW 51920, 'Geographic names must contain 1 to 256 UTF-16 units and cannot be blank.', 1;
        END
        IF @country_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [contacts].[country]
            WHERE [country_id]=@country_id AND [value_key]=CONVERT(VARBINARY(512),@country) AND [value_length]=DATALENGTH(@country))
        BEGIN
            THROW 51921, 'A geographic name contradicts the supplied or inferred ID.', 1;
        END
        IF @country_id IS NULL
        BEGIN
            EXEC [contacts].[country_value_ensure]
                @name = @country,
                @id = @country_id OUTPUT;
        END
    END
    IF @state IS NOT NULL
    BEGIN
        IF DATALENGTH(@state) NOT BETWEEN 2 AND 512 OR LEN(LTRIM(RTRIM(@state)))=0
        BEGIN
            THROW 51920, 'Geographic names must contain 1 to 256 UTF-16 units and cannot be blank.', 1;
        END
        IF @state_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [contacts].[state]
            WHERE [state_id]=@state_id AND [value_key]=CONVERT(VARBINARY(512),@state) AND [value_length]=DATALENGTH(@state))
        BEGIN
            THROW 51921, 'A geographic name contradicts the supplied or inferred ID.', 1;
        END
        IF @state_id IS NULL
        BEGIN
            IF @country_id IS NULL
            BEGIN
                THROW 51921, 'Geographic names require explicit parent context; no unscoped lookup is performed.', 1;
            END
            EXEC [contacts].[state_value_ensure]
                @name = @state,
                @country_id = @country_id,
                @id = @state_id OUTPUT;
        END
    END
    IF @county IS NOT NULL
    BEGIN
        IF DATALENGTH(@county) NOT BETWEEN 2 AND 512 OR LEN(LTRIM(RTRIM(@county)))=0
        BEGIN
            THROW 51920, 'Geographic names must contain 1 to 256 UTF-16 units and cannot be blank.', 1;
        END
        IF @county_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [contacts].[county]
            WHERE [county_id]=@county_id AND [value_key]=CONVERT(VARBINARY(512),@county) AND [value_length]=DATALENGTH(@county))
        BEGIN
            THROW 51921, 'A geographic name contradicts the supplied or inferred ID.', 1;
        END
        IF @county_id IS NULL
        BEGIN
            IF @country_id IS NULL
            BEGIN
                THROW 51921, 'Geographic names require explicit parent context; no unscoped lookup is performed.', 1;
            END
            EXEC [contacts].[county_value_ensure]
                @name = @county,
                @country_id = @country_id,
                @state_id = @state_id,
                @id = @county_id OUTPUT;
        END
    END
    IF @city IS NOT NULL
    BEGIN
        IF DATALENGTH(@city) NOT BETWEEN 2 AND 512 OR LEN(LTRIM(RTRIM(@city)))=0
        BEGIN
            THROW 51920, 'Geographic names must contain 1 to 256 UTF-16 units and cannot be blank.', 1;
        END
        IF @city_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [contacts].[city]
            WHERE [city_id]=@city_id AND [value_key]=CONVERT(VARBINARY(512),@city) AND [value_length]=DATALENGTH(@city))
        BEGIN
            THROW 51921, 'A geographic name contradicts the supplied or inferred ID.', 1;
        END
        IF @city_id IS NULL
        BEGIN
            IF @country_id IS NULL
            BEGIN
                THROW 51921, 'Geographic names require explicit parent context; no unscoped lookup is performed.', 1;
            END
            EXEC [contacts].[city_value_ensure]
                @name = @city,
                @country_id = @country_id,
                @state_id = @state_id,
                @id = @city_id OUTPUT;
        END
    END
    IF @colony IS NOT NULL
    BEGIN
        IF DATALENGTH(@colony) NOT BETWEEN 2 AND 512 OR LEN(LTRIM(RTRIM(@colony)))=0
        BEGIN
            THROW 51920, 'Geographic names must contain 1 to 256 UTF-16 units and cannot be blank.', 1;
        END
        IF @colony_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [contacts].[colony]
            WHERE [colony_id]=@colony_id AND [value_key]=CONVERT(VARBINARY(512),@colony) AND [value_length]=DATALENGTH(@colony))
        BEGIN
            THROW 51921, 'A geographic name contradicts the supplied or inferred ID.', 1;
        END
        IF @colony_id IS NULL
        BEGIN
            IF @city_id IS NULL
            BEGIN
                THROW 51921, 'Geographic names require explicit parent context; no unscoped lookup is performed.', 1;
            END
            EXEC [contacts].[colony_value_ensure]
                @name = @colony,
                @city_id = @city_id,
                @id = @colony_id OUTPUT;
        END
    END
    IF @city_id IS NOT NULL AND EXISTS (SELECT 1 FROM [contacts].[city] WHERE [city_id]=@city_id
        AND ([country_id]<>@country_id OR [state_id]<>@state_id
            OR ([state_id] IS NULL AND @state_id IS NOT NULL) OR ([state_id] IS NOT NULL AND @state_id IS NULL)))
    BEGIN
        THROW 51921, 'Geographic child scope contradicts the resolved address ancestors.', 1;
    END
    IF @county_id IS NOT NULL AND EXISTS (SELECT 1 FROM [contacts].[county] WHERE [county_id]=@county_id
        AND ([country_id]<>@country_id OR [state_id]<>@state_id
            OR ([state_id] IS NULL AND @state_id IS NOT NULL) OR ([state_id] IS NOT NULL AND @state_id IS NULL)))
    BEGIN
        THROW 51921, 'Geographic child scope contradicts the resolved address ancestors.', 1;
    END
END;
