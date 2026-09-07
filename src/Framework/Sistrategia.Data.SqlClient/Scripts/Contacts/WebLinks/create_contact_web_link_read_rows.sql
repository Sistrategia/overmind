-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_web_link_read_rows.sql
-- Created / Last Update: 2026-Sep-07. See ADR 0011.
-- Version: 8.0.0.0.

-- Private component: caller has resolved tenant/revisions and holds the shared root barrier.
CREATE OR ALTER PROCEDURE [contacts].[contact_web_link_read_rows]
    @contact_id INT,
    @tenant_id INT,
    @bound BIGINT,
    @compare BIGINT=NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM [contacts].[contact_web_links_as_of](@contact_id,@bound) ORDER BY [display_order],[ordinal];
    -- Compare revision -> requested revision; compare NULL deliberately yields an empty diff.
    SELECT COALESCE(n.[ordinal],o.[ordinal]) AS [ordinal],
        CASE WHEN o.[ordinal] IS NULL THEN 'insert' WHEN n.[ordinal] IS NULL THEN 'delete'
            WHEN o.[web_link_id]=n.[web_link_id] AND (o.[link_type]=n.[link_type] OR (o.[link_type] IS NULL AND n.[link_type] IS NULL))
                AND (CONVERT(VARBINARY(MAX),o.display_text)=CONVERT(VARBINARY(MAX),n.display_text) AND DATALENGTH(o.display_text)=DATALENGTH(n.display_text) OR (o.display_text IS NULL AND n.display_text IS NULL)) AND o.[is_public]=n.[is_public]
                AND (o.[location_id]=n.[location_id] OR (o.[location_id] IS NULL AND n.[location_id] IS NULL))
            THEN 'move' ELSE 'update' END AS [operation],
        o.[url] AS [old_url],n.[url] AS [url],
        o.[location_name] AS [old_location_name],n.[location_name] AS [location_name],
        o.[is_public] AS [old_is_public],n.[is_public] AS [is_public],
        o.[display_order] AS [old_display_order],n.[display_order] AS [display_order],
        o.link_type AS old_link_type,n.link_type,o.display_text AS old_display_text,n.display_text
    FROM [contacts].[contact_web_links_as_of](@contact_id,@compare) o
    FULL JOIN [contacts].[contact_web_links_as_of](@contact_id,@bound) n ON n.[ordinal]=o.[ordinal]
    WHERE @compare IS NOT NULL AND (o.[ordinal] IS NULL OR n.[ordinal] IS NULL OR o.[web_link_id]<>n.[web_link_id] OR o.[link_type]<>n.[link_type]
        OR (o.link_type IS NULL AND n.link_type IS NOT NULL) OR (o.link_type IS NOT NULL AND n.link_type IS NULL)
        OR CONVERT(VARBINARY(MAX),o.display_text)<>CONVERT(VARBINARY(MAX),n.display_text) OR DATALENGTH(o.display_text)<>DATALENGTH(n.display_text)
        OR (o.display_text IS NULL AND n.display_text IS NOT NULL) OR (o.display_text IS NOT NULL AND n.display_text IS NULL)
        OR o.[is_public]<>n.[is_public] OR o.[location_id]<>n.[location_id]
        OR o.[display_order]<>n.[display_order]
        OR (o.[location_id] IS NULL AND n.[location_id] IS NOT NULL) OR (o.[location_id] IS NOT NULL AND n.[location_id] IS NULL))
    ORDER BY COALESCE(n.[ordinal],o.[ordinal]);

    SELECT a.[dbrow_version],a.[action_ordinal],a.[ordinal],a.[operation],e.[url],
        l.[location_name],a.[is_public],a.[show_in_timeline],a.[payload_version],v.[recorded_at],v.[modified_by],
        a.[previous_display_order],a.[display_order],a.link_type,a.display_text
    FROM [contacts].[contact_web_link_action] a
    JOIN [contacts].[web_link] e ON e.[web_link_id]=a.[web_link_id]
    LEFT JOIN [contacts].[web_link_location] l ON l.[location_id]=a.[location_id]
    JOIN [data].[dbrow_version] v ON v.[tenant_id]=a.[tenant_id] AND v.[dbrow_version]=a.[dbrow_version]
    WHERE a.[tenant_id]=@tenant_id AND a.[contact_id]=@contact_id AND a.[dbrow_version]=@bound
    ORDER BY a.[dbrow_version],a.[action_ordinal];
END;
