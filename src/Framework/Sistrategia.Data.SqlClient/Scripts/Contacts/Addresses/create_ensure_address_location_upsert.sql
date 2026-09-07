-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_ensure_address_location_upsert.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0012.

CREATE OR ALTER PROCEDURE [contacts].[ensure_address_location_upsert]
    @country_id INT=NULL,
    @country_name NVARCHAR(MAX)=NULL,
    @state_id INT=NULL,
    @state_name NVARCHAR(MAX)=NULL,
    @city_id INT=NULL,
    @city_name NVARCHAR(MAX)=NULL,
    @out_country_id INT OUTPUT,
    @out_state_id INT OUTPUT,
    @out_city_id INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC [data].[audit_isolation_assert];
    IF XACT_STATE()<>1
    BEGIN
        THROW 51001, 'Geographic resolution requires the caller transaction.', 1;
    END
    SET @out_country_id=NULL;
    SET @out_state_id=NULL;
    SET @out_city_id=NULL;
    EXEC [contacts].[address_geography_resolve]
        @country_id = @country_id OUTPUT,
        @country = @country_name,
        @state_id = @state_id OUTPUT,
        @state = @state_name,
        @city_id = @city_id OUTPUT,
        @city = @city_name;
    SET @out_country_id=@country_id;
    SET @out_state_id=@state_id;
    SET @out_city_id=@city_id;
END;
