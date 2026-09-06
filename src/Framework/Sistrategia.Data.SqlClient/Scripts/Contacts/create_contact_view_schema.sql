CREATE VIEW [contacts].[contact_view] AS
SELECT c.[contact_id],
       e.[public_key]
     , e.[tenant_id], e.[tenant], e.[tenant_name]
     , e.[logical_key], e.[display_name]
     , e.[created]
     , e.[modified], e.[modified_by]
     , e.[modified_by_public_key] AS [modified_by_public_key]	 
	 , e.[modified_by_display_name] AS [modified_by_display_name]
     , e.[modified_by_email] AS [modified_by_email]
     , e.[modified_by_thumbnail_url] AS [modified_by_thumbnail_url]
     , e.[locked], e.[validated]
     , e.[summary]     
     , e.[image_url]
     , e.[thumbnail_url]
     , e.[is_private], e.[is_system]
     , c.[contact_type_id]
     , c.[full_name]
     --, c.[person_title], c.[person_first_name]
     --, c.[person_last_name], c.[person_last_name1], c.[person_last_name2]
     --, c.[person_suffix], c.[person_alias]
     , cpnn1.[name] AS [person_title]
     , cpnn2.[name] AS [person_first_name]     
     , COALESCE(cpnn3.[name], cpnn4.[name] + ' ' + cpnn5.[name], cpnn4.[name]) AS [person_last_name]
     , cpnn4.[name] AS [person_last_name1]
     , cpnn5.[name] AS [person_last_name2]
     , cpnn6.[name] AS [person_suffix]
     , cpnn7.[name] AS [person_alias]
     , c.[person_job_title] --, c.[person_company]
     , COALESCE(coe.[display_name], c.[person_company]) AS [person_company]     
     , coe.[public_key] AS [person_company_public_key]
     , cde.[display_name] AS [person_division]
     , cde.[public_key] AS [person_division_public_key]
     --
     , gre.[display_name] AS [contact_group]
     , gre.[public_key] AS [contact_group_public_key]
     --
     , c.[person_gender_code], c.[person_birth_date]     
     , COALESCE('(' + p.[area_code] + ') ' + p.[phone_number], p.[phone_number]) AS [phone_number]
     , p.[phone_number] AS [phone_local_number]
     , p.[area_code] AS [phone_area_code], cp.[extension] AS [phone_extension] -- , p.[numbers_only] AS [phone_numbers_only]
     , em.[email_address]
     , ad.[address1], ad.[address2], ad.[zip_code]
     , adc.[city], ads.[state], adco.[country] -- ad.[city_id], ad.[state_id], ad.[country_id]
     , c.[person_job_title] AS [contact_list_info_card1] 
     , c.[person_company] AS [contact_list_info_card2] 

--   , e.[entity_version]
     , e.[dbrow_version]
FROM [contacts].[contact] AS c 
INNER JOIN [entities].[entity_view] AS e ON (e.[entity_id] = c.[contact_id])
--INNER JOIN [security].[user] AS md ON (e.[modified_by] = md.[user_id])
--INNER JOIN [entities].[entity] AS mde ON (e.[modified_by] = mde.[entity_id])

LEFT JOIN [contacts].[contact_person_name] AS cpn1 ON(c.[contact_id] = cpn1.[contact_id] AND cpn1.[person_name_type_id] = 1) 
LEFT JOIN [contacts].[person_name] AS cpnn1 ON(cpn1.[person_name_id] = cpnn1.[person_name_id]) 
LEFT JOIN [contacts].[contact_person_name] AS cpn2 ON(c.[contact_id] = cpn2.[contact_id] AND cpn2.[person_name_type_id] = 2) 
LEFT JOIN [contacts].[person_name] AS cpnn2 ON(cpn2.[person_name_id] = cpnn2.[person_name_id]) 
LEFT JOIN [contacts].[contact_person_name] AS cpn3 ON(c.[contact_id] = cpn3.[contact_id] AND cpn3.[person_name_type_id] = 3) 
LEFT JOIN [contacts].[person_name] AS cpnn3 ON(cpn3.[person_name_id] = cpnn3.[person_name_id]) 
LEFT JOIN [contacts].[contact_person_name] AS cpn4 ON(c.[contact_id] = cpn4.[contact_id] AND cpn4.[person_name_type_id] = 4) 
LEFT JOIN [contacts].[person_name] AS cpnn4 ON(cpn4.[person_name_id] = cpnn4.[person_name_id]) 
LEFT JOIN [contacts].[contact_person_name] AS cpn5 ON(c.[contact_id] = cpn5.[contact_id] AND cpn5.[person_name_type_id] = 5) 
LEFT JOIN [contacts].[person_name] AS cpnn5 ON(cpn5.[person_name_id] = cpnn5.[person_name_id]) 
LEFT JOIN [contacts].[contact_person_name] AS cpn6 ON(c.[contact_id] = cpn6.[contact_id] AND cpn6.[person_name_type_id] = 6) 
LEFT JOIN [contacts].[person_name] AS cpnn6 ON(cpn6.[person_name_id] = cpnn6.[person_name_id]) 
LEFT JOIN [contacts].[contact_person_name] AS cpn7 ON(c.[contact_id] = cpn7.[contact_id] AND cpn7.[person_name_type_id] = 7) 
LEFT JOIN [contacts].[person_name] AS cpnn7 ON(cpn7.[person_name_id] = cpnn7.[person_name_id]) 

LEFT JOIN [contacts].[contact_phone] AS cp ON(c.contact_id = cp.contact_id AND cp.ordinal = 1) 
LEFT JOIN [contacts].[phone] AS p ON(cp.phone_id = p.phone_id) 
OUTER APPLY (SELECT TOP(1) * FROM [contacts].[contact_email] ce
    WHERE ce.contact_id=c.contact_id ORDER BY ce.display_order,ce.ordinal) AS ce
LEFT JOIN [contacts].[email] AS em ON(ce.email_id = em.email_id) 

LEFT JOIN [contacts].[contact_address] AS ca ON(c.contact_id = ca.contact_id AND ca.ordinal = 1) 
LEFT JOIN [contacts].[address] AS ad ON(ca.address_id = ad.address_id) 
LEFT JOIN [contacts].[city] AS adc ON(ad.city_id = adc.city_id) 
LEFT JOIN [contacts].[state] AS ads ON(ad.state_id = ads.state_id) 
LEFT JOIN [contacts].[country] AS adco ON(ad.country_id = adco.country_id) 

--
LEFT JOIN [contacts].[contact_relationship] AS r ON(r.from_contact_id = e.[entity_id] AND r.[contact_relationship_type_id] = 2) 
LEFT JOIN [entities].[entity_view] AS coe ON (coe.[entity_id] = r.[to_contact_id])
LEFT JOIN [contacts].[contact_relationship] AS rd ON(rd.from_contact_id = coe.[entity_id] AND rd.[contact_relationship_type_id] = 1 )
LEFT JOIN [entities].[entity_view] AS cde ON (cde.[entity_id] = rd.[to_contact_id])
--
LEFT JOIN [contacts].[contact_relationship] AS rg ON(rg.from_contact_id = e.[entity_id] AND rg.[contact_relationship_type_id] = 1) 
LEFT JOIN [entities].[entity_view] AS gre ON (gre.[entity_id] = rg.[to_contact_id])

-- WHERE e.[is_system] = 0
-- WHERE e.[deleted] IS NULL AND e.[is_system] = 0 -- WHERE [contact_id] > 1
