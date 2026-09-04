/*************************************************************************************************************
* create_contact_schema.sql is part of the Sistrategia.Contacts Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):   J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:      2022-Jan-04
* Created:          2010-Sep-08
* Version:          6.0.6829.0
*************************************************************************************************************/

INSERT INTO [entities].[entity_type] ([entity_type_id],[code_name],[database_schema],[database_table],[database_view]) 
VALUES (1, 'contact', 'contacts', 'contact', 'contact_view');

INSERT INTO [contacts].[contact_type] ([contact_type_id],[code_name]) VALUES (1, 'person');
INSERT INTO [contacts].[contact_type] ([contact_type_id],[code_name]) VALUES (2, 'organization');
INSERT INTO [contacts].[contact_type] ([contact_type_id],[code_name]) VALUES (3, 'group');

-- INSERT INTO [contacts].[contact_type] ([contact_type_id],[code_name],[singular_name],[plural_name],[singular_name_es],[plural_name_es]) VALUES (1, 'person', 'Person', 'People', 'Persona', 'Personas');
-- INSERT INTO [contacts].[contact_type] ([contact_type_id],[code_name],[singular_name],[plural_name],[singular_name_es],[plural_name_es]) VALUES (2, 'organization', 'Organization', 'Organizations', 'Organización', 'Organizaciones');
-- INSERT INTO [contacts].[contact_type] ([contact_type_id],[code_name],[singular_name],[plural_name],[singular_name_es],[plural_name_es]) VALUES (3, 'group', 'Group', 'Groups', 'Grupo', 'Grupos');

MERGE [contacts].[contact_type_localized] AS t
USING (VALUES
     (1,1,N'Person',N'People'),(1,2,N'Persona',N'Personas')
    ,(2,1,N'Organization',N'Organizations'),(2,2,N'Organización',N'Organizaciones')
    ,(3,1,N'Group',N'Groups'),(3,2,N'Grupo',N'Grupos')
) AS s([id],[lang],[sn],[pn])
ON t.[contact_type_id] = s.[id] AND t.[language_id] = s.[lang]
WHEN NOT MATCHED THEN INSERT VALUES (s.[id],s.[lang],s.[sn],s.[pn]);

-- INSERT INTO [contacts].[person_name_type] ([person_name_type_id],[code_name],[display_name],[display_name_es]) VALUES (1, 'person_title', 'Title', 'Título');
-- INSERT INTO [contacts].[person_name_type] ([person_name_type_id],[code_name],[display_name],[display_name_es]) VALUES (2, 'person_first_name', 'First Name', 'Nombre(s)');
-- INSERT INTO [contacts].[person_name_type] ([person_name_type_id],[code_name],[display_name],[display_name_es]) VALUES (3, 'person_last_name', 'Last Name', 'Apellidos');
-- INSERT INTO [contacts].[person_name_type] ([person_name_type_id],[code_name],[display_name],[display_name_es]) VALUES (4, 'person_last_name1', 'Last Name', 'Apellido Paterno');
-- INSERT INTO [contacts].[person_name_type] ([person_name_type_id],[code_name],[display_name],[display_name_es]) VALUES (5, 'person_last_name2', 'Mother''s Maiden Name', 'Apellido Materno');
-- INSERT INTO [contacts].[person_name_type] ([person_name_type_id],[code_name],[display_name],[display_name_es]) VALUES (6, 'person_suffix', 'Suffix', 'Sufijo');
-- INSERT INTO [contacts].[person_name_type] ([person_name_type_id],[code_name],[display_name],[display_name_es]) VALUES (7, 'person_alias', 'Alias', 'Alias');

INSERT INTO [contacts].[person_name_type] ([person_name_type_id],[code_name]) VALUES (1, 'person_title');
INSERT INTO [contacts].[person_name_type] ([person_name_type_id],[code_name]) VALUES (2, 'person_first_name');
INSERT INTO [contacts].[person_name_type] ([person_name_type_id],[code_name]) VALUES (3, 'person_last_name');
INSERT INTO [contacts].[person_name_type] ([person_name_type_id],[code_name]) VALUES (4, 'person_last_name1');
INSERT INTO [contacts].[person_name_type] ([person_name_type_id],[code_name]) VALUES (5, 'person_last_name2');
INSERT INTO [contacts].[person_name_type] ([person_name_type_id],[code_name]) VALUES (6, 'person_suffix');
INSERT INTO [contacts].[person_name_type] ([person_name_type_id],[code_name]) VALUES (7, 'person_alias');



INSERT INTO [contacts].[person_name_type_localized] ([person_name_type_id],[language_id],[display_name]) VALUES (1,1,N'Title');
INSERT INTO [contacts].[person_name_type_localized] ([person_name_type_id],[language_id],[display_name]) VALUES (2,1,N'First Name');
INSERT INTO [contacts].[person_name_type_localized] ([person_name_type_id],[language_id],[display_name]) VALUES (3,1,N'Last Name');
INSERT INTO [contacts].[person_name_type_localized] ([person_name_type_id],[language_id],[display_name]) VALUES (4,1,N'Last Name 1');
INSERT INTO [contacts].[person_name_type_localized] ([person_name_type_id],[language_id],[display_name]) VALUES (5,1,N'Last Name 2');
INSERT INTO [contacts].[person_name_type_localized] ([person_name_type_id],[language_id],[display_name]) VALUES (6,1,N'Suffix');
INSERT INTO [contacts].[person_name_type_localized] ([person_name_type_id],[language_id],[display_name]) VALUES (7,1,N'Alias');

INSERT INTO [contacts].[person_name_type_localized] ([person_name_type_id],[language_id],[display_name]) VALUES (1,2,N'Título');
INSERT INTO [contacts].[person_name_type_localized] ([person_name_type_id],[language_id],[display_name]) VALUES (2,2,N'Nombre(s)');
INSERT INTO [contacts].[person_name_type_localized] ([person_name_type_id],[language_id],[display_name]) VALUES (3,2,N'Apellidos');
INSERT INTO [contacts].[person_name_type_localized] ([person_name_type_id],[language_id],[display_name]) VALUES (4,2,N'Apellido Paterno');
INSERT INTO [contacts].[person_name_type_localized] ([person_name_type_id],[language_id],[display_name]) VALUES (5,2,N'Apellido Materno');
INSERT INTO [contacts].[person_name_type_localized] ([person_name_type_id],[language_id],[display_name]) VALUES (6,2,N'Sufijo');
INSERT INTO [contacts].[person_name_type_localized] ([person_name_type_id],[language_id],[display_name]) VALUES (7,2,N'Alias');




--INSERT INTO [contacts].[contact_relationship_type] ([contact_relationship_type_id],[code_name],[display_name],[display_name_es]) VALUES (1, 'person_title', 'Title', 'Título');
INSERT INTO [contacts].[contact_relationship_type] ([code_name],[display_name],[display_name_es]) VALUES ('memberof', 'member of', 'miembro de');
INSERT INTO [contacts].[contact_relationship_type] ([code_name],[display_name],[display_name_es]) VALUES ('worksfor', 'works for', 'trabaja para');
INSERT INTO [contacts].[contact_relationship_type] ([code_name],[display_name],[display_name_es]) VALUES ('supplierof','supplier of','proveedor de');
INSERT INTO [contacts].[contact_relationship_type] ([code_name],[display_name],[display_name_es]) VALUES ('ownerof', 'owner of', N'dueño de');




-- -----------------------------------------------------------------------------------------------------------
-- Event types (titles/summaries resolved at read time from [entities].[event_type_localized] templates)
-- FK [event_type_localized].[language_id] -> [data].[language] is satisfied: languages are seeded in the
-- data module's InsertMinimalData, which runs before this contacts InsertMinimalData (phase 4).
-- -----------------------------------------------------------------------------------------------------------
INSERT INTO [entities].[event_type] ([code_name]) VALUES ('contacts.contact.new');

INSERT INTO [entities].[event_type_localized] ([event_type_id],[language_id],[title_template],[summary_template])
    VALUES ((SELECT [event_type_id] FROM [entities].[event_type] WHERE [code_name] = 'contacts.contact.new'),
            1, N'Contact added.', N'[[Author.FullName]] added the contact [[Subject.Name]].');
INSERT INTO [entities].[event_type_localized] ([event_type_id],[language_id],[title_template],[summary_template])
    VALUES ((SELECT [event_type_id] FROM [entities].[event_type] WHERE [code_name] = 'contacts.contact.new'),
            2, N'Contacto agregado.', N'[[Author.FullName]] agregó el contacto [[Subject.Name]].');

-- IF (EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'entities' AND TABLE_NAME = 'event_type'))
-- BEGIN
-- 	INSERT INTO [entities].[event_type] ([code_name],[display_name],[description]) VALUES ('contacts.contact.new', 'contacts.contact.new', 'Event generated by adding a contact in the system.');
--     INSERT INTO [entities].[event_type] ([code_name],[display_name],[description]) VALUES ('contacts.contact.edit', 'contacts.contact.edit', 'Event generated by updating a contact in the system.');
--     INSERT INTO [entities].[event_type] ([code_name],[display_name],[description]) VALUES ('contacts.contact.delete', 'contacts.contact.delete', 'Event generated by deleting a contact in the system.');
-- 	INSERT INTO [entities].[event_type] ([code_name],[display_name],[description]) VALUES ('contacts.phone.new', 'contacts.phone.new', 'Event generated by adding a phone in the system.');
--     INSERT INTO [entities].[event_type] ([code_name],[display_name],[description]) VALUES ('contacts.phone.edit', 'contacts.phone.edit', 'Event generated by updating a phone in the system.');
--     INSERT INTO [entities].[event_type] ([code_name],[display_name],[description]) VALUES ('contacts.phone.delete', 'contacts.phone.delete', 'Event generated by deleting a phone in the system.');
--     INSERT INTO [entities].[event_type] ([code_name],[display_name],[description]) VALUES ('contacts.email.new', 'contacts.email.new', 'Event generated by adding an email in the system.');
--     INSERT INTO [entities].[event_type] ([code_name],[display_name],[description]) VALUES ('contacts.email.edit', 'contacts.email.edit', 'Event generated by updating an email in the system.');
--     INSERT INTO [entities].[event_type] ([code_name],[display_name],[description]) VALUES ('contacts.email.delete', 'contacts.email.delete', 'Event generated by deleting an email in the system.');
--     INSERT INTO [entities].[event_type] ([code_name],[display_name],[description]) VALUES ('contacts.address.new', 'contacts.address.new', 'Event generated by adding an address in the system.');
-- END