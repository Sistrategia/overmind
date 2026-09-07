-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_phone_read_rows.sql
-- Created / Last Update: 2026-Sep-07. See ADR 0009 and ADR 0010.

-- Private component: caller has resolved tenant/revisions and holds the shared root barrier.
CREATE OR ALTER PROCEDURE [contacts].[contact_phone_read_rows]
    @contact_id INT, @tenant_id INT, @bound BIGINT, @compare BIGINT=NULL
AS
BEGIN
    SET NOCOUNT ON;
        SELECT * FROM [contacts].[contact_phones_as_of](@contact_id,@bound) ORDER BY [display_order],[ordinal];
        -- Compare revision -> requested revision; compare NULL deliberately yields an empty diff.
        SELECT COALESCE(n.[ordinal],o.[ordinal]) AS [ordinal],
            CASE WHEN o.[ordinal] IS NULL THEN 'insert' WHEN n.[ordinal] IS NULL THEN 'delete'
                WHEN o.[input_id]=n.[input_id]
                    AND (CONVERT(VARBINARY(MAX),o.extension)=CONVERT(VARBINARY(MAX),n.extension) AND DATALENGTH(o.extension)=DATALENGTH(n.extension) OR (o.extension IS NULL AND n.extension IS NULL)) AND o.[is_public]=n.[is_public]
                    AND (o.[location_id]=n.[location_id] OR (o.[location_id] IS NULL AND n.[location_id] IS NULL))
                THEN 'move' ELSE 'update' END AS [operation],
            o.[e164] AS [old_e164],n.[e164] AS [e164],
            o.[location_name] AS [old_location_name],n.[location_name] AS [location_name],
            o.[is_public] AS [old_is_public],n.[is_public] AS [is_public],
            o.[display_order] AS [old_display_order],n.[display_order] AS [display_order],
            o.phone_data AS old_phone_data,n.phone_data,o.extension AS old_extension,n.extension
        FROM [contacts].[contact_phones_as_of](@contact_id,@compare) o
        FULL JOIN [contacts].[contact_phones_as_of](@contact_id,@bound) n ON n.[ordinal]=o.[ordinal]
        WHERE @compare IS NOT NULL AND (o.[ordinal] IS NULL OR n.[ordinal] IS NULL OR o.[input_id]<>n.[input_id]
            OR CONVERT(VARBINARY(MAX),o.extension)<>CONVERT(VARBINARY(MAX),n.extension) OR DATALENGTH(o.extension)<>DATALENGTH(n.extension)
            OR (o.extension IS NULL AND n.extension IS NOT NULL) OR (o.extension IS NOT NULL AND n.extension IS NULL)
            OR o.[is_public]<>n.[is_public] OR o.[location_id]<>n.[location_id]
            OR o.[display_order]<>n.[display_order]
            OR (o.[location_id] IS NULL AND n.[location_id] IS NOT NULL) OR (o.[location_id] IS NOT NULL AND n.[location_id] IS NULL))
        ORDER BY COALESCE(n.[ordinal],o.[ordinal]);

        SELECT a.[dbrow_version],a.[action_ordinal],a.[ordinal],a.[operation],e.[e164],
            l.[location_name],a.[is_public],a.[show_in_timeline],a.[payload_version],v.[recorded_at],v.[modified_by],
            a.[previous_display_order],a.[display_order],i.phone_data,a.extension
        FROM [contacts].[contact_phone_action] a
        JOIN [contacts].[phone] e ON e.[phone_id]=a.[phone_id]
        JOIN [contacts].[phone_input] i ON i.input_id=a.input_id
        LEFT JOIN [contacts].[phone_location] l ON l.[location_id]=a.[location_id]
        JOIN [data].[dbrow_version] v ON v.[tenant_id]=a.[tenant_id] AND v.[dbrow_version]=a.[dbrow_version]
        WHERE a.[tenant_id]=@tenant_id AND a.[contact_id]=@contact_id AND a.[dbrow_version]=@bound
        ORDER BY a.[dbrow_version],a.[action_ordinal];
END;
