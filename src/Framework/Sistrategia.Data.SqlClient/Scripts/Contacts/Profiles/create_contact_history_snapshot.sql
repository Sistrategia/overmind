-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_history_snapshot.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0013.

-- Private final profile snapshot: only replace this active unit's stamped root payload.
CREATE OR ALTER PROCEDURE [contacts].[contact_history_snapshot]
    @contact_id INT,
    @tenant_id INT,
    @dbrow_version BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC [data].[audit_unit_assert] @dbrow_version OUTPUT;
    IF NOT EXISTS (SELECT 1 FROM [entities].[entity] e
        JOIN [entities].[entity_version_history] h ON h.[entity_id]=e.[entity_id] AND h.[dbrow_version]=e.[dbrow_version]
            AND h.[tenant_id]=e.[tenant_id] AND h.[entity_version]=e.[entity_version]
        WHERE e.[entity_id]=@contact_id AND e.[tenant_id]=@tenant_id AND e.[dbrow_version]=@dbrow_version)
    BEGIN
        THROW 51205, 'Profile snapshot requires this unit stamped root and spine.', 1;
    END
    DECLARE @payload TABLE ([contact_type_id] INT,
        [full_name] NVARCHAR(256),
        [person_job_title] NVARCHAR(256),
        [person_company] NVARCHAR(256),
        [person_gender_code] CHAR(1),
        [person_birth_date] DATE,
        [person_birth_city_id] INT,
        [person_birth_state_id] INT,
        [person_birth_country_id] INT,
        [person_marital_status] CHAR(1),
        [do_not_contact] BIT,
        [open_to_work] BIT,
        [recruiting] BIT,
        [is_deceased] BIT,
        [person_title_id] INT,
        [person_first_name_id] INT,
        [person_last_name_id] INT,
        [person_last_name1_id] INT,
        [person_last_name2_id] INT,
        [person_suffix_id] INT,
        [person_alias_id] INT);
    INSERT @payload
    SELECT c.[contact_type_id],
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
         n.[person_title_id],
         n.[person_first_name_id],
         n.[person_last_name_id],
         n.[person_last_name1_id],
         n.[person_last_name2_id],
         n.[person_suffix_id],
         n.[person_alias_id]
    FROM [contacts].[contact] c
    OUTER APPLY (SELECT MAX(CASE WHEN [person_name_type_id]=1 THEN [person_name_id] END) AS [person_title_id],
        MAX(CASE WHEN [person_name_type_id]=2 THEN [person_name_id] END) AS [person_first_name_id],
        MAX(CASE WHEN [person_name_type_id]=3 THEN [person_name_id] END) AS [person_last_name_id],
        MAX(CASE WHEN [person_name_type_id]=4 THEN [person_name_id] END) AS [person_last_name1_id],
        MAX(CASE WHEN [person_name_type_id]=5 THEN [person_name_id] END) AS [person_last_name2_id],
        MAX(CASE WHEN [person_name_type_id]=6 THEN [person_name_id] END) AS [person_suffix_id],
        MAX(CASE WHEN [person_name_type_id]=7 THEN [person_name_id] END) AS [person_alias_id]
        FROM [contacts].[contact_person_name] WHERE [contact_id]=@contact_id) n
    WHERE c.[contact_id]=@contact_id;
    UPDATE h SET [contact_type_id]=p.[contact_type_id],
        [full_name]=p.[full_name],
        [person_job_title]=p.[person_job_title],
        [person_company]=p.[person_company],
        [person_gender_code]=p.[person_gender_code],
        [person_birth_date]=p.[person_birth_date],
        [person_birth_city_id]=p.[person_birth_city_id],
        [person_birth_state_id]=p.[person_birth_state_id],
        [person_birth_country_id]=p.[person_birth_country_id],
        [person_marital_status]=p.[person_marital_status],
        [do_not_contact]=p.[do_not_contact],
        [open_to_work]=p.[open_to_work],
        [recruiting]=p.[recruiting],
        [is_deceased]=p.[is_deceased],
        [person_title_id]=p.[person_title_id],
        [person_first_name_id]=p.[person_first_name_id],
        [person_last_name_id]=p.[person_last_name_id],
        [person_last_name1_id]=p.[person_last_name1_id],
        [person_last_name2_id]=p.[person_last_name2_id],
        [person_suffix_id]=p.[person_suffix_id],
        [person_alias_id]=p.[person_alias_id]
    FROM [contacts].[contact_history] h CROSS JOIN @payload p
    WHERE h.[contact_id]=@contact_id AND h.[tenant_id]=@tenant_id AND h.[dbrow_version]=@dbrow_version;
    IF @@ROWCOUNT=0
    BEGIN
        INSERT [contacts].[contact_history] ([dbrow_version],
            [tenant_id],
            [contact_id],
            [contact_type_id],
            [full_name],
            [person_job_title],
            [person_company],
            [person_gender_code],
            [person_birth_date],
            [person_birth_city_id],
            [person_birth_state_id],
            [person_birth_country_id],
            [person_marital_status],
            [do_not_contact],
            [open_to_work],
            [recruiting],
            [is_deceased],
            [person_title_id],
            [person_first_name_id],
            [person_last_name_id],
            [person_last_name1_id],
            [person_last_name2_id],
            [person_suffix_id],
            [person_alias_id])
        SELECT @dbrow_version,
            @tenant_id,
            @contact_id,
            [contact_type_id],
            [full_name],
            [person_job_title],
            [person_company],
            [person_gender_code],
            [person_birth_date],
            [person_birth_city_id],
            [person_birth_state_id],
            [person_birth_country_id],
            [person_marital_status],
            [do_not_contact],
            [open_to_work],
            [recruiting],
            [is_deceased],
            [person_title_id],
            [person_first_name_id],
            [person_last_name_id],
            [person_last_name1_id],
            [person_last_name2_id],
            [person_suffix_id],
            [person_alias_id] FROM @payload;
    END
END;
