DECLARE @RC INT
DECLARE @tenant UNIQUEIDENTIFIER
-- DECLARE @created_by UNIQUEIDENTIFIER
-- DECLARE @created DATETIME2
-- DECLARE @dbrow_version BIGINT

-- SET @tenant = '3267B1C0-8CE0-4A72-BCC2-86EEF07E3583'
-- SET @tenant = '908E5A8C-0372-4EDC-ADDF-011E059091ED'
-- SET @created_by = '97A45AEE-EF87-4EFF-98D5-E51195A6669A'
-- SET @created = '2022-01-04 21:00:00.000'
-- SET @dbrow_version = NULL


INSERT INTO [security].[role] ([tenant_id],[role_name],[display_name],[description]) VALUES (NULL, 'Guest', 'Guest', 'Invited user') -- 2015-07-16
INSERT INTO [security].[role_localized] ([role_id],[language_id],[display_name],[description]) VALUES (1, 1, N'Guest', N'Invited user') -- 2015-07-16
INSERT INTO [security].[role_localized] ([role_id],[language_id],[display_name],[description]) VALUES (1, 2, N'Invitado', N'Usuario invitado') -- 2015-07-16

INSERT INTO [security].[role] ([tenant_id],[role_name],[display_name],[description]) VALUES (NULL, 'User', 'User', 'Standard user') -- 2015-07-16
INSERT INTO [security].[role_localized] ([role_id],[language_id],[display_name],[description]) VALUES (2, 1, N'User', N'Standard user') -- 2015-07-16
INSERT INTO [security].[role_localized] ([role_id],[language_id],[display_name],[description]) VALUES (2, 2, N'Usuario', N'Usuario estándar') -- 2015-07-16

INSERT INTO [security].[role] ([tenant_id],[role_name],[display_name],[description]) VALUES (NULL, 'Admin', 'Admin', 'Administrator user') -- 2015-07-16
INSERT INTO [security].[role_localized] ([role_id],[language_id],[display_name],[description]) VALUES (3, 1, N'Admin', N'Administrator user') -- 2015-07-16
INSERT INTO [security].[role_localized] ([role_id],[language_id],[display_name],[description]) VALUES (3, 2, N'Administrador', N'Usuario administrador') -- 2015-07-16

INSERT INTO [security].[role] ([tenant_id],[role_name],[display_name],[description]) VALUES (NULL, 'Developer', 'Developer', N'System''s Developer user') -- 2015-07-16
INSERT INTO [security].[role_localized] ([role_id],[language_id],[display_name],[description]) VALUES (4, 1, N'Developer', N'System''s Developer user') -- 2015-07-16
INSERT INTO [security].[role_localized] ([role_id],[language_id],[display_name],[description]) VALUES (4, 2, N'Developer', N'Usuario desarrollador del sistema') -- 2015-07-16
