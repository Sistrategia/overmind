/*************************************************************************************************************
* insert_minimal_data.sql is part of the Sistrategia.Core Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):	J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:		2025-Jul-14
* Created:			2010-Sep-08
* Version:			8.0.0.0
*************************************************************************************************************/

-- -----------------------------------------------------------------------------------------------------------
-- Table [data].[schema_version]
-- -----------------------------------------------------------------------------------------------------------

INSERT INTO [data].[schema_version] VALUES ('8.0.0.0');

-- -----------------------------------------------------------------------------------------------------------
-- Table [data].[language]
-- -----------------------------------------------------------------------------------------------------------

MERGE [data].[language] AS t
USING (VALUES (1,N'en',N'English',N'English'),
              (2,N'es-MX',N'Spanish (Mexico)',N'Español (México)'),
              (3,N'ja',N'Japanese',N'日本語')) AS s([id],[code],[name],[loc])
ON t.[language_id] = s.[id]
WHEN NOT MATCHED THEN INSERT ([language_id],[code],[display_name],[localized_name])
    VALUES (s.[id],s.[code],s.[name],s.[loc]);

-- -----------------------------------------------------------------------------------------------------------
-- Table [data].[dboperation_type]
-- -----------------------------------------------------------------------------------------------------------

MERGE [data].[dboperation_type] AS t
USING (VALUES (1,N'INSERT'),(2,N'UPDATE'),(3,N'DELETE'),(4,N'UNDOVR'),(5,N'UNDODL'),
              (6,N'LOCKED'),(7,N'UNLOCK'),(8,N'VALIDA'),(9,N'INVALD'),(10,N'ERASED')) AS s([id],[code])
ON t.[dboperation_type_id] = s.[id]
WHEN NOT MATCHED THEN INSERT ([dboperation_type_id],[dboperation_code]) VALUES (s.[id], s.[code]);

-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (1, 'INSERT', 'Agregar', 'Agregó');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (2, 'UPDATE', 'Actualizar', 'Actualizó');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (3, 'DELETE', 'Eliminar', 'Eliminó');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (4, 'UNDOVR', 'Restaurar', 'Restauró');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (5, 'UNDODL', 'Recuperar', 'Recuperó');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (6, 'LOCKED', 'Bloquear', 'Bloqueó');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (7, 'UNLOCK', 'Desbloquear', 'Desbloqueó');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (8, 'VALIDA', 'Validar', 'Validó');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (9, 'INVALD', 'Desvalidar', 'Desvalidó');
-- INSERT INTO [data].[dboperation_type] ([dboperation_type_id], [dboperation_code], [display_name], [action_display_name]) VALUES (10, 'ERASED', 'Eliminar Permanentemente', 'Eliminó Permanentemente');

MERGE [data].[dboperation_type_localized] AS t
USING (VALUES
     (1,1,N'Insert',N'Added'),        (1,2,N'Agregar',N'Agregó')
    ,(2,1,N'Update',N'Updated'),      (2,2,N'Actualizar',N'Actualizó')
    ,(3,1,N'Delete',N'Deleted'),      (3,2,N'Eliminar',N'Eliminó')
    ,(4,1,N'Restore',N'Restored'),    (4,2,N'Restaurar',N'Restauró')
    ,(5,1,N'Recover',N'Recovered'),   (5,2,N'Recuperar',N'Recuperó')
    ,(6,1,N'Lock',N'Locked'),         (6,2,N'Bloquear',N'Bloqueó')
    ,(7,1,N'Unlock',N'Unlocked'),     (7,2,N'Desbloquear',N'Desbloqueó')
    ,(8,1,N'Validate',N'Validated'),  (8,2,N'Validar',N'Validó')
    ,(9,1,N'Invalidate',N'Invalidated'),(9,2,N'Desvalidar',N'Desvalidó')
    ,(10,1,N'Erase',N'Erased'),       (10,2,N'Borrar (regulatorio)',N'Borró (regulatorio)')
) AS s([op],[lang],[dn],[adn])
ON t.[dboperation_type_id] = s.[op] AND t.[language_id] = s.[lang]
WHEN NOT MATCHED THEN INSERT ([dboperation_type_id],[language_id],[display_name],[action_display_name])
    VALUES (s.[op],s.[lang],s.[dn],s.[adn]);

-- -----------------------------------------------------------------------------------------------------------
-- Table [data].[module]
-- -----------------------------------------------------------------------------------------------------------

MERGE [data].[module] AS t
USING (VALUES (N'data',N'1.0.0',1),(N'entities',N'1.0.0',2),
              (N'contacts',N'1.0.0',3),(N'security',N'1.0.0',4)) AS s([code_name],[schema_version],[install_order])
ON t.[code_name] = s.[code_name]
WHEN NOT MATCHED THEN INSERT ([code_name],[schema_version],[install_order]) VALUES (s.[code_name],s.[schema_version],s.[install_order]);