-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_profile_as_of.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0013.

CREATE OR ALTER FUNCTION [contacts].[contact_profile_as_of] (@contact_id INT, @bound BIGINT)
RETURNS TABLE
AS RETURN (
    SELECT (SELECT c.[contact_type_id],
            c.[full_name],
            c.[person_job_title],
            c.[person_company],
            c.[person_gender_code],
            c.[person_birth_date],
            c.[person_birth_city_id],
            c.[person_birth_state_id],
            c.[person_birth_country_id],
            c.[person_marital_status],
            c.[do_not_contact],
            c.[open_to_work],
            c.[recruiting],
            c.[is_deceased],
            e.[logical_key],
            e.[display_name],
            e.[summary],
            e.[image_url],
            e.[thumbnail_url],
            e.[is_private],
            e.[deleted],
            e.[deleted_by],
            e.[locked],
            e.[locked_by],
            e.[validated],
            e.[validated_by],
            n1.[name] AS [person_title],
            n2.[name] AS [person_first_name],
            n3.[name] AS [person_last_name],
            n4.[name] AS [person_last_name1],
            n5.[name] AS [person_last_name2],
            n6.[name] AS [person_suffix],
            n7.[name] AS [person_alias]
            FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER) AS [profile_data]
    FROM (SELECT TOP(1) * FROM [contacts].[contact_history] WITH (FORCESEEK,INDEX([ix_contact_history_root]))
        WHERE [contact_id]=@contact_id AND [dbrow_version]<=@bound ORDER BY [dbrow_version] DESC) c
    CROSS JOIN (SELECT TOP(1) * FROM [entities].[entity_history] WITH (FORCESEEK,INDEX([ix_entity_history_root]))
        WHERE [entity_id]=@contact_id AND [dbrow_version]<=@bound ORDER BY [dbrow_version] DESC) e
    LEFT JOIN [contacts].[person_name] n1 ON n1.[person_name_id]=c.[person_title_id]
    LEFT JOIN [contacts].[person_name] n2 ON n2.[person_name_id]=c.[person_first_name_id]
    LEFT JOIN [contacts].[person_name] n3 ON n3.[person_name_id]=c.[person_last_name_id]
    LEFT JOIN [contacts].[person_name] n4 ON n4.[person_name_id]=c.[person_last_name1_id]
    LEFT JOIN [contacts].[person_name] n5 ON n5.[person_name_id]=c.[person_last_name2_id]
    LEFT JOIN [contacts].[person_name] n6 ON n6.[person_name_id]=c.[person_suffix_id]
    LEFT JOIN [contacts].[person_name] n7 ON n7.[person_name_id]=c.[person_alias_id]
    WHERE c.[contact_type_id] IS NOT NULL
);
