-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_addresses_as_of.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0012.

-- Internal relational building block. The public reader validates tenant/revision and
-- supplies a consistent transaction. An absent/tombstoned child does not appear.
CREATE OR ALTER FUNCTION [contacts].[contact_addresses_as_of] (@contact_id INT, @bound BIGINT)
RETURNS TABLE
AS RETURN (
    SELECT h.[ordinal],h.[address_id],v.[address_data],h.[location_id],l.[location_name],h.[is_public],h.[dbrow_version],h.[display_order]
    FROM [contacts].[contact_address_identity] i
    CROSS APPLY (
        SELECT TOP(1) * FROM [contacts].[contact_address_history] h
        WHERE h.[contact_id]=i.[contact_id] AND h.[ordinal]=i.[ordinal] AND h.[dbrow_version]<=@bound
        ORDER BY h.[dbrow_version] DESC
    ) h
    JOIN [contacts].[address_value_view] v ON v.[address_id]=h.[address_id]
    LEFT JOIN [contacts].[address_location] l ON l.[location_id]=h.[location_id]
    WHERE i.[contact_id]=@contact_id AND i.[created_version]<=@bound AND h.[dboperation_type_id]<>3
);
