-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_web_links_as_of.sql
-- Created / Last Update: 2026-Sep-07. See ADR 0011.
-- Version: 8.0.0.0.

-- Internal relational building block. The public reader validates tenant/revision and
-- supplies a consistent transaction. An absent/tombstoned child does not appear.
CREATE OR ALTER FUNCTION [contacts].[contact_web_links_as_of] (@contact_id INT, @bound BIGINT)
RETURNS TABLE
AS RETURN (
    SELECT h.[ordinal],h.[web_link_id],v.[url],h.[location_id],l.[location_name],h.[is_public],h.[dbrow_version],h.[display_order],h.[link_type],h.[display_text]
    FROM [contacts].[contact_web_link_identity] i
    CROSS APPLY (
        SELECT TOP(1) * FROM [contacts].[contact_web_link_history] h
        WHERE h.[contact_id]=i.[contact_id] AND h.[ordinal]=i.[ordinal] AND h.[dbrow_version]<=@bound
        ORDER BY h.[dbrow_version] DESC
    ) h
    JOIN [contacts].[web_link] v ON v.[web_link_id]=h.[web_link_id]
    LEFT JOIN [contacts].[web_link_location] l ON l.[location_id]=h.[location_id]
    WHERE i.[contact_id]=@contact_id AND i.[created_version]<=@bound AND h.[dboperation_type_id]<>3
);
