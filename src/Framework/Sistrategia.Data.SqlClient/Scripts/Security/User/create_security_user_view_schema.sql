CREATE VIEW [security].[user_view] AS
SELECT u.[user_id],
       c.[public_key]
     , c.[tenant_id], c.[tenant], c.[tenant_name]
     , c.[logical_key]
     , COALESCE(c.[person_alias], c.[display_name]) AS [display_name]
     , c.[created]
     , c.[modified], c.[modified_by]
     , c.[modified_by_public_key]
	 , c.[modified_by_display_name]
     , c.[modified_by_email]
     , c.[modified_by_thumbnail_url]
     , c.[locked], c.[validated]
     , c.[summary]     
     , c.[image_url]
     , c.[thumbnail_url]
     , c.[is_private], c.[is_system]
     , c.[contact_type_id]
     , c.[full_name], c.[person_title], c.[person_first_name]
     , c.[person_last_name], c.[person_last_name1], c.[person_last_name2]
     , c.[person_suffix], c.[person_alias]
     , c.[person_job_title], c.[person_company]

     , c.[person_company_public_key]
     , c.[person_division]
     , c.[person_division_public_key] 

     , c.[person_gender_code], c.[person_birth_date]
     , c.[phone_number], c.[phone_local_number], c.[phone_area_code], c.[phone_extension] -- , c.[phone_numbers_only]
     , c.[email_address] 

     , c.[address1], c.[address2], c.[zip_code]
     , c.[city], c.[state], c.[country] -- ad.[city_id], ad.[state_id], ad.[country_id]

     , c.[contact_list_info_card1] 
     , c.[contact_list_info_card2] 
     , u.[login_name]
     , CASE WHEN u.[password_salt] IS NOT NULL THEN CONCAT(u.[password_hash], '.', u.[password_salt]) ELSE u.[password_hash] END AS [password_hash]
     -- , u.[password_hash]
     , u.[security_stamp]
     , COALESCE(r.[role_id], 1) AS [role_id]
     , COALESCE(r.[role_name], N'Guest') AS [role_name]
     , c.[dbrow_version]
FROM [security].[user] AS u
INNER JOIN [contacts].[contact_view] AS c ON (u.[user_id] = c.[contact_id])
LEFT JOIN [security].[user_role] AS ur ON (ur.[user_id] = u.[user_id] 
    AND ur.[role_id] = (SELECT TOP 1 [role_id] FROM [security].[user_role] 
        WHERE [user_id] = u.[user_id] ORDER BY [role_id] DESC) )
LEFT JOIN [security].[role] AS r ON (ur.[role_id] = r.[role_id])
