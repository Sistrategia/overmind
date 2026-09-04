/*************************************************************************************************************
* insert_minimal_data.sql is part of the Sistrategia.Security Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):   J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:      2022-Jan-04
* Created:          2010-Sep-08
* Version:          6.0.6829.0
*************************************************************************************************************/

-- -----------------------------------------------------------------------------------------------------------
-- Event types (titles/summaries resolved at read time from [entities].[event_type_localized] templates)
-- FK [event_type_localized].[language_id] -> [data].[language] is satisfied: languages are seeded in the
-- data module's InsertMinimalData, which runs before this security InsertMinimalData (phase 4).
-- -----------------------------------------------------------------------------------------------------------
INSERT INTO [entities].[event_type] ([code_name]) VALUES ('security.user.new');

INSERT INTO [entities].[event_type_localized] ([event_type_id],[language_id],[title_template],[summary_template])
    VALUES ((SELECT [event_type_id] FROM [entities].[event_type] WHERE [code_name] = 'security.user.new'),
            1, N'User added.', N'[[Author.FullName]] added the user [[Subject.Name]].');
INSERT INTO [entities].[event_type_localized] ([event_type_id],[language_id],[title_template],[summary_template])
    VALUES ((SELECT [event_type_id] FROM [entities].[event_type] WHERE [code_name] = 'security.user.new'),
            2, N'Usuario agregado.', N'[[Author.FullName]] agregó al usuario [[Subject.Name]].');
