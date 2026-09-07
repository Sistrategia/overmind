-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_phones_as_of.sql
-- Created / Last Update: 2026-Sep-07. See ADR 0009 and ADR 0010.

-- Internal relational building block. The public reader validates tenant/revision and
-- supplies a consistent transaction. An absent/tombstoned child does not appear.
CREATE OR ALTER FUNCTION [contacts].[contact_phones_as_of] (@contact_id INT, @bound BIGINT)
RETURNS TABLE
AS RETURN (
    SELECT h.[ordinal],h.[phone_id],v.[e164],h.[location_id],l.[location_name],h.[is_public],h.[dbrow_version],h.[display_order],h.[input_id],i2.[phone_data],h.[extension]
    FROM [contacts].[contact_phone_identity] i
    CROSS APPLY (
        SELECT TOP(1) * FROM [contacts].[contact_phone_history] h
        WHERE h.[contact_id]=i.[contact_id] AND h.[ordinal]=i.[ordinal] AND h.[dbrow_version]<=@bound
        ORDER BY h.[dbrow_version] DESC
    ) h
    JOIN [contacts].[phone] v ON v.[phone_id]=h.[phone_id]
    JOIN [contacts].[phone_input] i2 ON i2.input_id=h.input_id
    LEFT JOIN [contacts].[phone_location] l ON l.[location_id]=h.[location_id]
    WHERE i.[contact_id]=@contact_id AND i.[created_version]<=@bound AND h.[dboperation_type_id]<>3
);
