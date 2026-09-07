-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_address_value_view.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0012.

CREATE OR ALTER VIEW [contacts].[address_value_view]
AS
SELECT a.[address_id],
    (SELECT a.[address1],
        a.[address2],
        a.[street_name],
        a.[ext_number],
        a.[int_number],
        a.[zip_code],
        a.[references],
        a.[country_id],
        a.[state_id],
        a.[county_id],
        a.[city_id],
        a.[colony_id],
        country.[country], state.[state], county.[county], city.[city], colony.[colony]
        FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER) AS [address_data]
FROM [contacts].[address] a
LEFT JOIN [contacts].[country] country ON country.[country_id]=a.[country_id]
LEFT JOIN [contacts].[state] state ON state.[state_id]=a.[state_id]
LEFT JOIN [contacts].[county] county ON county.[county_id]=a.[county_id]
LEFT JOIN [contacts].[city] city ON city.[city_id]=a.[city_id]
LEFT JOIN [contacts].[colony] colony ON colony.[colony_id]=a.[colony_id]
;
