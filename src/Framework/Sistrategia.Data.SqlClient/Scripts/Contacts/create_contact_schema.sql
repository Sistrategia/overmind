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

-- IF SCHEMA_ID(N'contacts') IS NULL EXEC (N'CREATE SCHEMA [contacts]');
-- GO

INSERT INTO [entities].[entity_type] ([entity_type_id],[code_name],[database_schema],[database_table],[database_view]) 
VALUES (1, 'contact', 'contacts', 'contact', 'contact_view');

-- -----------------------------------------------------------------------------------------------------------
-- Table [contacts].[contact_type]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [contacts].[contact_type] (
     [contact_type_id]          INT                 NOT NULL
    ,[code_name]                NVARCHAR(50)        NOT NULL
    ,CONSTRAINT [px_contacts_contact_type] PRIMARY KEY CLUSTERED ( [contact_type_id] ASC )
    ,CONSTRAINT [uq_contact_type_code] UNIQUE ([code_name])
);

INSERT INTO [contacts].[contact_type] ([contact_type_id],[code_name]) VALUES (1, 'person');
INSERT INTO [contacts].[contact_type] ([contact_type_id],[code_name]) VALUES (2, 'organization');
INSERT INTO [contacts].[contact_type] ([contact_type_id],[code_name]) VALUES (3, 'group');

-- INSERT INTO [contacts].[contact_type] ([contact_type_id],[code_name],[singular_name],[plural_name],[singular_name_es],[plural_name_es]) VALUES (1, 'person', 'Person', 'People', 'Persona', 'Personas');
-- INSERT INTO [contacts].[contact_type] ([contact_type_id],[code_name],[singular_name],[plural_name],[singular_name_es],[plural_name_es]) VALUES (2, 'organization', 'Organization', 'Organizations', 'Organización', 'Organizaciones');
-- INSERT INTO [contacts].[contact_type] ([contact_type_id],[code_name],[singular_name],[plural_name],[singular_name_es],[plural_name_es]) VALUES (3, 'group', 'Group', 'Groups', 'Grupo', 'Grupos');

-- -----------------------------------------------------------------------------------------------------------
-- Table [contacts].[contact_type_localized]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [contacts].[contact_type_localized] (
     [contact_type_id]  INT            NOT NULL
    ,[language_id]      INT            NOT NULL
    ,[singular_name]    NVARCHAR(100)  NOT NULL
    ,[plural_name]      NVARCHAR(100)  NOT NULL
    ,CONSTRAINT [pk_contact_type_localized] PRIMARY KEY CLUSTERED ([contact_type_id],[language_id])
    ,CONSTRAINT [fk_ctl_type] FOREIGN KEY ([contact_type_id])
        REFERENCES [contacts].[contact_type]([contact_type_id])
    ,CONSTRAINT [fk_ctl_language] FOREIGN KEY ([language_id])
        REFERENCES [data].[language]([language_id]) ON DELETE CASCADE
);

MERGE [contacts].[contact_type_localized] AS t
USING (VALUES
     (1,1,N'Person',N'People'),(1,2,N'Persona',N'Personas')
    ,(2,1,N'Organization',N'Organizations'),(2,2,N'Organización',N'Organizaciones')
    ,(3,1,N'Group',N'Groups'),(3,2,N'Grupo',N'Grupos')
) AS s([id],[lang],[sn],[pn])
ON t.[contact_type_id] = s.[id] AND t.[language_id] = s.[lang]
WHEN NOT MATCHED THEN INSERT VALUES (s.[id],s.[lang],s.[sn],s.[pn]);

-- -----------------------------------------------------------------------------------------------------------
-- Table [contacts].[person_name_type]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [contacts].[person_name_type] (
     [person_name_type_id]      INT                 NOT NULL
    ,[code_name]                NVARCHAR(50)        NOT NULL
    -- ,[display_name]             NVARCHAR(50)        NOT NULL
    -- ,[display_name_es]          NVARCHAR(50)        NOT NULL
    ,CONSTRAINT [px_person_name_type] PRIMARY KEY CLUSTERED ( [person_name_type_id] ASC )
);

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


CREATE TABLE [contacts].[person_name_type_localized] (
     [person_name_type_id]  INT            NOT NULL
    ,[language_id]          INT            NOT NULL
    ,[display_name]         NVARCHAR(100)  NOT NULL
    ,CONSTRAINT [pk_person_name_type_localized] PRIMARY KEY CLUSTERED ([person_name_type_id],[language_id])
    ,CONSTRAINT [fk_pntl_type] FOREIGN KEY ([person_name_type_id])
        REFERENCES [contacts].[person_name_type]([person_name_type_id])
    ,CONSTRAINT [fk_pntl_language] FOREIGN KEY ([language_id])
        REFERENCES [data].[language]([language_id]) ON DELETE CASCADE
);

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

-- -----------------------------------------------------------------------------------------------------------
-- Table [contacts].[person_name]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [contacts].[person_name] (
     [person_name_id]           INT                 NOT NULL IDENTITY(1,1)
    ,[name]                     NVARCHAR(256)           NULL 
    ,[language_code]            NVARCHAR(6)             NULL -- opcional, for future multi-language support like: en-US, es-MX, etc. for Srta vs Miss, Sr. vs Mr., etc.
    ,CONSTRAINT [px_contacts_person_name] PRIMARY KEY CLUSTERED ( [person_name_id] ASC )
    ,CONSTRAINT [uq_person_name_name] UNIQUE ([name])
);
-- SET IDENTITY_INSERT [contacts].[person_name] ON;
-- INSERT INTO [contacts].[person_name] ([person_name_id],[name]) VALUES (0, N'(erased by official request)');
-- SET IDENTITY_INSERT [contacts].[person_name] OFF;

-- -----------------------------------------------------------------------------------------------------------
-- Table [contacts].[contact_person_name]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [contacts].[contact_person_name] (
     [contact_id]               INT                 NOT NULL
    ,[person_name_type_id]      INT                 NOT NULL
    ,[person_name_id]           INT                 NOT NULL    
--  ,[from_date]                DATETIME2           NOT NULL
--  ,[to_date]                  DATETIME2               NULL  
    ,CONSTRAINT [px_contact_person_name] PRIMARY KEY CLUSTERED ( [contact_id] ASC, [person_name_type_id] ASC)
);

-- -----------------------------------------------------------------------------------------------------------
-- Table [contacts].[contact]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [contacts].[contact] (
     [contact_id]	 				INT                 NOT NULL
    ,[contact_type_id]              INT                 NOT NULL
    ,[full_name]                    NVARCHAR(256)       NOT NULL
    ,[person_job_title]             NVARCHAR(256)           NULL
    ,[person_company]               NVARCHAR(256)           NULL
    ,[person_gender_code]           CHAR(1)                 NULL
--  ,[person_gender_display_name]   NVARCHAR(256)           NULL
    
    ,[person_birth_date]            DATE                    NULL
    ,[person_birth_city_id]         INT                     NULL
    ,[person_birth_state_id]        INT                     NULL
    ,[person_birth_country_id]      INT                     NULL

    ,[person_marital_status]        CHAR(1)                 NULL DEFAULT ('S')  -- S=Single, M=Married, D=Divorced, W=Widowed, C=Common-law
    
    ,[do_not_contact]               BIT                 NOT NULL CONSTRAINT [def_contact_do_not_contact] DEFAULT ((0))

    -- ,[line_of_business_id]          INT                     NULL -- classifiers!

    ,[open_to_work]                 BIT                     NULL DEFAULT 0
    ,[recruiting]                   BIT                     NULL DEFAULT 0

    ,[is_deceased]                  BIT                     NULL CONSTRAINT [def_contact_is_deceased] DEFAULT((0))

    --,[person_credential_id]       NVARCHAR(50)            NULL
    --,[person_ife]                 NVARCHAR(50)            NULL
    --,[person_driver_license]      NVARCHAR(50)            NULL
    --,[person_professional_license] NVARCHAR(50)           NULL

    --,[person_immigration_document]        NVARCHAR(50)    NULL
    --,[person_immigration_document_level]  NVARCHAR(50)    NULL
    --,[person_passport]            NVARCHAR(50)            NULL
    --,[person_visa]                NVARCHAR(50)            NULL
    --,[person_nationality]         NVARCHAR(50)            NULL
    --,[person_other_id]            NVARCHAR(50)            NULL
    --,[person_curp]                NVARCHAR(50)            NULL

--  ,[organization_name]            NVARCHAR(256)           NULL
--  ,[group_type_id]                INT                     NULL
--  ,[group_name]                   NVARCHAR(256)           NULL
--  ,[custom_display_name]          BIT                 NOT NULL CONSTRAINT [def_contact_custom_display_name] DEFAULT ((0))

--  ,[activity]                     NVARCHAR(256)           NULL
--  ,[billing_name]                 NVARCHAR(256)           NULL
--  ,[rfc]                          NVARCHAR(13)            NULL
    	
--  ,[contact_list_info_card1]      NVARCHAR(256)           NULL
--  ,[contact_list_info_card2]      NVARCHAR(256)           NULL

	,CONSTRAINT [px_contacts_contact] PRIMARY KEY CLUSTERED ( [contact_id] ASC )	
--  ,CONSTRAINT [uqc_contacts_contact_public_key] UNIQUE NONCLUSTERED ( [public_key] ASC )
--  ,CONSTRAINT [uqc_contacts_contact_login_name] UNIQUE NONCLUSTERED ( [login_name] ASC )
    --,CONSTRAINT [uqc_contacts_contact_full_name] UNIQUE NONCLUSTERED ( [full_name] ASC )
---- ,CONSTRAINT [uq_security_user_login_name] UNIQUE NONCLUSTERED ( [login_name] ASC )
---- ,CONSTRAINT [uqc_security_user_dbrow_identity]	UNIQUE CLUSTERED ( [dbrow_identity] ASC )
) 

ALTER TABLE [contacts].[contact] WITH CHECK ADD CONSTRAINT [fk_contact_contact_type] FOREIGN KEY([contact_type_id])
REFERENCES [contacts].[contact_type] ([contact_type_id])

ALTER TABLE [contacts].[contact] CHECK CONSTRAINT [fk_contact_contact_type]

ALTER TABLE [contacts].[contact] WITH CHECK ADD CONSTRAINT [fk_contact_entity] FOREIGN KEY([contact_id])
REFERENCES [entities].[entity] ([entity_id])

ALTER TABLE [contacts].[contact] CHECK CONSTRAINT [fk_contact_entity]

-- ALTER TABLE [contacts].[contact] WITH CHECK ADD CONSTRAINT [fk_contact_line_of_business] FOREIGN KEY([line_of_business_id])
-- REFERENCES [contacts].[line_of_business] ([line_of_business_id]);

-- ALTER TABLE [contacts].[contact] CHECK CONSTRAINT [fk_contact_line_of_business];

CREATE NONCLUSTERED INDEX [ix_contact_open_to_work] 
    ON [contacts].[contact] ([open_to_work])
    INCLUDE ([contact_type_id], [full_name], [person_job_title])
    WHERE [open_to_work] = 1;

 CREATE NONCLUSTERED INDEX [ix_contact_recruiting] 
    ON [contacts].[contact] ([recruiting])
    INCLUDE ([contact_type_id], [full_name])
    WHERE [recruiting] = 1;

-- -----------------------------------------------------------------------------------------------------------
-- Table [contacts].[contact_history]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [contacts].[contact_history] (
     [dbrow_version]                BIGINT              NOT NULL
    ,[tenant_id]                    INT                 NOT NULL
    ,[contact_id]	 				INT                 NOT NULL
--  ,[contact_type_id]              INT                 NOT NULL -- this should never change
    ,[full_name]                    NVARCHAR(256)       NOT NULL
    ,[person_job_title]             NVARCHAR(256)           NULL
    ,[person_company]               NVARCHAR(256)           NULL
    ,[person_gender_code]           CHAR(1)                 NULL
    
    ,[person_birth_date]            DATE                    NULL
    ,[person_birth_city_id]         INT                     NULL
    ,[person_birth_state_id]        INT                     NULL
    ,[person_birth_country_id]      INT                     NULL

    ,[person_marital_status]        CHAR(1)                 NULL 
    ,[do_not_contact]               BIT                 NOT NULL
    ,[line_of_business_id]          INT                     NULL

    ,[open_to_work]                 BIT                     NULL
    ,[recruiting]                   BIT                     NULL

    ,[is_deceased]                  BIT                     NULL

	,CONSTRAINT [px_contacts_contact_history] PRIMARY KEY CLUSTERED ( [dbrow_version] ASC, [tenant_id] ASC, [contact_id] ASC )
) 

ALTER TABLE [contacts].[contact_history] ADD CONSTRAINT [fk_contact_history_dbrow_version] FOREIGN KEY([tenant_id], [dbrow_version])
REFERENCES [data].[dbrow_version] ([tenant_id], [dbrow_version]);
ALTER TABLE [contacts].[contact_history] CHECK CONSTRAINT [fk_contact_history_dbrow_version];

ALTER TABLE [contacts].[contact_history] WITH CHECK ADD CONSTRAINT [fk_contact_history_contact] FOREIGN KEY([contact_id])
REFERENCES [contacts].[contact] ([contact_id])
ALTER TABLE [contacts].[contact_history] CHECK CONSTRAINT [fk_contact_history_contact]

-- ALTER TABLE [contacts].[contact_history] WITH CHECK ADD CONSTRAINT [fk_contact_history_line_of_business] FOREIGN KEY([line_of_business_id])
-- REFERENCES [contacts].[line_of_business] ([line_of_business_id]);
-- ALTER TABLE [contacts].[contact_history] CHECK CONSTRAINT [fk_contact_history_line_of_business];

-- ALTER TABLE [contacts].[contact_history] ADD CONSTRAINT [fk_contact_history_entity] FOREIGN KEY([contact_id])
-- REFERENCES [entities].[entity] ([entity_id]);
-- ALTER TABLE [contacts].[contact_history] CHECK CONSTRAINT [fk_contact_history_entity];




CREATE TABLE [contacts].[contact_relationship_type] (
     [contact_relationship_type_id]      INT                 NOT NULL IDENTITY(1,1)
    ,[code_name]                         NVARCHAR(256)       NOT NULL
    ,[display_name]                      NVARCHAR(256)       NOT NULL
    ,[display_name_es]                   NVARCHAR(256)       NOT NULL
    ,CONSTRAINT [px_contact_relationship_type] PRIMARY KEY CLUSTERED ( [contact_relationship_type_id] ASC )
);

--INSERT INTO [contacts].[contact_relationship_type] ([contact_relationship_type_id],[code_name],[display_name],[display_name_es]) VALUES (1, 'person_title', 'Title', 'Título');
INSERT INTO [contacts].[contact_relationship_type] ([code_name],[display_name],[display_name_es]) VALUES ('memberof', 'member of', 'miembro de');
INSERT INTO [contacts].[contact_relationship_type] ([code_name],[display_name],[display_name_es]) VALUES ('worksfor', 'works for', 'trabaja para');
INSERT INTO [contacts].[contact_relationship_type] ([code_name],[display_name],[display_name_es]) VALUES ('supplierof','supplier of','proveedor de');
INSERT INTO [contacts].[contact_relationship_type] ([code_name],[display_name],[display_name_es]) VALUES ('ownerof', 'owner of', N'dueño de');

CREATE TABLE [contacts].[contact_relationship] (
     [contact_relationship_type_id]     INT     NOT NULL 
    ,[from_contact_id]                  INT     NOT NULL
    ,[to_contact_id]                    INT     NOT NULL
--  ,[created]                          DATETIME2 NOT NULL    CONSTRAINT [def_contact_relationship_created] DEFAULT (GETUTCDATE())
--  ,[created_by]                       INT     NOT NULL    
--  ,CONSTRAINT [pk_contact_relationship] PRIMARY KEY CLUSTERED ( [contact_relationship_type_id] ASC, [from_contact_id] ASC, [to_contact_id] ASC )	
    ,CONSTRAINT [pk_contact_relationship] PRIMARY KEY CLUSTERED ( [from_contact_id] ASC, [contact_relationship_type_id] ASC, [to_contact_id] ASC )	
);


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