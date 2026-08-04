/*************************************************************************************************************
* create_security_user_role_schema.sql is part of the Sistrategia.Security Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):   J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:      2022-Jan-04
* Created:          2010-Sep-08
* Version:          6.0.6829.0
*************************************************************************************************************/

-- -----------------------------------------------------------------------------------------------------------
-- Table [security].[user_role]
-- -----------------------------------------------------------------------------------------------------------
CREATE TABLE [security].[user_role] (
--   [user_role_id]     INT     NOT NULL    IDENTITY(1,1)
     [user_id]          INT     NOT NULL
	,[role_id]          INT     NOT NULL
	,CONSTRAINT [px_security_user_role] PRIMARY KEY CLUSTERED ( [user_id] ASC, [role_id] ASC )	
) 

ALTER TABLE [security].[user_role]  WITH CHECK ADD CONSTRAINT [fk_user_role_user] FOREIGN KEY([user_id])
REFERENCES [security].[user] ([user_id])
ON DELETE CASCADE

ALTER TABLE [security].[user_role]  WITH CHECK ADD CONSTRAINT [fk_user_role_role] FOREIGN KEY([role_id])
REFERENCES [security].[role] ([role_id])
-- NO DELETE CASCADE!

--CREATE TABLE [AspNetUserRoles] (
--    [UserId] nvarchar(450) NOT NULL,
--    [RoleId] nvarchar(450) NOT NULL,
--    CONSTRAINT [PK_AspNetUserRoles] PRIMARY KEY ([UserId], [RoleId]),
--    CONSTRAINT [FK_AspNetUserRoles_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE,
--    CONSTRAINT [FK_AspNetUserRoles_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
--);