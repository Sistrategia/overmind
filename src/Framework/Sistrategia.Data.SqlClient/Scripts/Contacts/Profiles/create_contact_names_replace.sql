-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_names_replace.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0013.

-- Private replacement of all supported name components under the root write lock.
CREATE OR ALTER PROCEDURE [contacts].[contact_names_replace]
    @contact_id INT,
    @person_title NVARCHAR(MAX) = NULL,
    @person_first_name NVARCHAR(MAX) = NULL,
    @person_last_name NVARCHAR(MAX) = NULL,
    @person_last_name1 NVARCHAR(MAX) = NULL,
    @person_last_name2 NVARCHAR(MAX) = NULL,
    @person_suffix NVARCHAR(MAX) = NULL,
    @person_alias NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM [contacts].[contact_person_name] WHERE [contact_id]=@contact_id;
    DECLARE @name_id INT;
    IF @person_title IS NOT NULL
    BEGIN
        EXEC [contacts].[person_name_value_ensure]
            @name = @person_title,
            @id = @name_id OUTPUT;
        INSERT [contacts].[contact_person_name] ([contact_id],[person_name_type_id],[person_name_id])
        VALUES (@contact_id,1,@name_id);
    END
    IF @person_first_name IS NOT NULL
    BEGIN
        EXEC [contacts].[person_name_value_ensure]
            @name = @person_first_name,
            @id = @name_id OUTPUT;
        INSERT [contacts].[contact_person_name] ([contact_id],[person_name_type_id],[person_name_id])
        VALUES (@contact_id,2,@name_id);
    END
    IF @person_last_name IS NOT NULL
    BEGIN
        EXEC [contacts].[person_name_value_ensure]
            @name = @person_last_name,
            @id = @name_id OUTPUT;
        INSERT [contacts].[contact_person_name] ([contact_id],[person_name_type_id],[person_name_id])
        VALUES (@contact_id,3,@name_id);
    END
    IF @person_last_name1 IS NOT NULL
    BEGIN
        EXEC [contacts].[person_name_value_ensure]
            @name = @person_last_name1,
            @id = @name_id OUTPUT;
        INSERT [contacts].[contact_person_name] ([contact_id],[person_name_type_id],[person_name_id])
        VALUES (@contact_id,4,@name_id);
    END
    IF @person_last_name2 IS NOT NULL
    BEGIN
        EXEC [contacts].[person_name_value_ensure]
            @name = @person_last_name2,
            @id = @name_id OUTPUT;
        INSERT [contacts].[contact_person_name] ([contact_id],[person_name_type_id],[person_name_id])
        VALUES (@contact_id,5,@name_id);
    END
    IF @person_suffix IS NOT NULL
    BEGIN
        EXEC [contacts].[person_name_value_ensure]
            @name = @person_suffix,
            @id = @name_id OUTPUT;
        INSERT [contacts].[contact_person_name] ([contact_id],[person_name_type_id],[person_name_id])
        VALUES (@contact_id,6,@name_id);
    END
    IF @person_alias IS NOT NULL
    BEGIN
        EXEC [contacts].[person_name_value_ensure]
            @name = @person_alias,
            @id = @name_id OUTPUT;
        INSERT [contacts].[contact_person_name] ([contact_id],[person_name_type_id],[person_name_id])
        VALUES (@contact_id,7,@name_id);
    END
END;
