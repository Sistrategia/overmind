-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_profile_read_rows.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0013.

-- Private: coordinator holds the shared root barrier and has resolved revision bounds.
CREATE OR ALTER PROCEDURE [contacts].[contact_profile_read_rows]
    @contact_id INT,
    @tenant_id INT,
    @bound BIGINT,
    @compare BIGINT=NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @current NVARCHAR(MAX)=(SELECT [profile_data] FROM [contacts].[contact_profile_as_of](@contact_id,@bound));
    DECLARE @old NVARCHAR(MAX)=(SELECT [profile_data] FROM [contacts].[contact_profile_as_of](@contact_id,@compare));
    IF @current IS NULL OR (@compare IS NOT NULL AND @old IS NULL)
    BEGIN
        THROW 52010, 'Complete profile history is unavailable for the requested revision.', 1;
    END
    SELECT @current AS [profile_data];
    SELECT @old AS [old_profile_data],@current AS [profile_data]
    WHERE @compare IS NOT NULL AND (CONVERT(VARBINARY(MAX),@old)<>CONVERT(VARBINARY(MAX),@current) OR DATALENGTH(@old)<>DATALENGTH(@current));
    SELECT a.[action_ordinal],a.[operation],a.[profile_data],a.[payload_version],v.[recorded_at],v.[modified_by]
    FROM [contacts].[contact_profile_action] a
    JOIN [data].[dbrow_version] v ON v.[tenant_id]=a.[tenant_id] AND v.[dbrow_version]=a.[dbrow_version]
    WHERE a.[contact_id]=@contact_id AND a.[tenant_id]=@tenant_id AND a.[dbrow_version]=@bound
    ORDER BY a.[action_ordinal];
END;
