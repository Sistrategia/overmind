CREATE VIEW [entities].[entity_view] AS
SELECT e.[entity_id]
    , e.[entity_type_id]
    , e.[tenant_id]
    , t.[public_key] AS [tenant]
    , t.[name] AS [tenant_name]
    , et.[code_name] AS [code_name]
    , e.[public_key]
    , e.[logical_key]
    , e.[display_name]
    , e.[created]
    , e.[modified]
    , e.[modified_by]
    , mde.[public_key] AS [modified_by_public_key]	 
    , COALESCE(mdalias.[name], mde.[display_name]) AS [modified_by_display_name] -- person_alias
--  , mde.[display_name] AS [modified_by_display_name]
    , COALESCE(em.[email_address], md.[login_name]) AS [modified_by_email]
--  , md.[email_address] AS [modified_by_email] -- posiblemente debería ser este
    , mde.[thumbnail_url] AS [modified_by_thumbnail_url]
    , e.[locked], e.[validated]
    , e.[summary]     
    , e.[image_url]
    , e.[thumbnail_url]
    , e.[is_private], e.[is_system]     
    , emd.[json_data] AS [metadata] 
    , e.[dbrow_version]
FROM [entities].[entity] AS e 
INNER JOIN [entities].[entity_type] AS et ON (e.[entity_type_id] = et.[entity_type_id])
INNER JOIN [data].[tenant] AS t ON (e.[tenant_id] = t.[tenant_id])
INNER JOIN [security].[user] AS md ON (e.[modified_by] = md.[user_id])
INNER JOIN [entities].[entity] AS mde ON (e.[modified_by] = mde.[entity_id])
INNER JOIN [contacts].[contact] AS mdc ON (e.[modified_by] = mdc.[contact_id])
LEFT JOIN [contacts].[contact_person_name] AS mdpn ON(mdc.[contact_id] = mdpn.[contact_id] AND mdpn.[person_name_type_id] = 7) -- alias
LEFT JOIN [contacts].[person_name] AS mdalias ON(mdpn.[person_name_id] = mdalias.[person_name_id]) 
LEFT JOIN [contacts].[contact_email] AS mdce ON(mdc.contact_id = mdce.contact_id AND mdce.ordinal = 1) 
LEFT JOIN [contacts].[email] AS em ON(mdce.email_id = em.email_id) 
LEFT JOIN [entities].[entity_metadata] AS emd ON (e.[entity_id] = emd.[entity_id])
WHERE e.[deleted] IS NULL -- AND e.[is_system] = 0 -- WHERE [contact_id] > 1 