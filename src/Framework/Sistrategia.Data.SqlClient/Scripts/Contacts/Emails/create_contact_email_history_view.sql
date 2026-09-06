CREATE OR ALTER VIEW [contacts].[contact_email_history_view] AS
SELECT h.[tenant_id],h.[contact_id],h.[ordinal],h.[dbrow_version],s.[entity_version],
    h.[dboperation_type_id],h.[email_id],e.[email_address],h.[location_id],l.[location_name],h.[is_public],
    v.[recorded_at],v.[modified_by],h.[display_order]
FROM [contacts].[contact_email_history] h
JOIN [entities].[entity_version_history] s ON s.[entity_id]=h.[contact_id] AND s.[dbrow_version]=h.[dbrow_version] AND s.[tenant_id]=h.[tenant_id]
JOIN [data].[dbrow_version] v ON v.[tenant_id]=h.[tenant_id] AND v.[dbrow_version]=h.[dbrow_version]
JOIN [contacts].[email] e ON e.[email_id]=h.[email_id]
LEFT JOIN [contacts].[email_location] l ON l.[location_id]=h.[location_id];
