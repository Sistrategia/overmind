/*************************************************************************************************************
* insert_minimal_data.sql is part of the Sistrategia.Core Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):   J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:      2022-Jan-04
* Created:          2010-Sep-08
* Version:          6.0.6829.0
*************************************************************************************************************/

INSERT INTO [entities].[entity_type] ([entity_type_id],[code_name],[database_schema],[database_table],[database_view]) 
VALUES (0, 'tenant', 'data', 'tenant', 'tenant_view');

INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('vatid', 'VATID')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('rfc', 'RFC')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('curp', 'CURP')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('studentid', 'Matrícula')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('cedula.numero', 'Cédula Profesional')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('nss', 'NSS')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('npie', 'NPIE')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('folio', 'Folio')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('operacion', 'Operación')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('repse', 'REPSE')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('repse.folio', 'REPSE Folio')
-- INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('repse.actividad', 'Proveedor REPSE Actividad')

INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('supplierid', 'ID del Proveedor')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('contract.id', 'Contrato')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('contactoname', 'Contacto')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('contactoemail', 'Correo')

INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('razonsocial','Razón Social')

INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('customer.name', 'Cliente')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('customer.rfc', 'Cliente RFC')

INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('supplier.name', 'Proveedor')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('supplier.rfc', 'Proveedor RFC')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('supplier.npie', 'Proveedor NPIE')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('supplier.repse', 'Proveedor REPSE')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('supplier.repse.folio', 'Proveedor REPSE Folio')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('supplier.repse.actividad', 'Proveedor REPSE Actividad')

INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('vigencia.inicio', 'Inicio Vigencia')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('vigencia.fin', 'Fin Vigencia')

INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('ods', 'ODS')
INSERT INTO [entities].[identifier_type] ([identifier_key], [identifier_name]) VALUES ('uuid', 'UUID')






INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('created','Created','Fecha de creación')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('modified','Modified','Fecha de modificación')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('validated','Validated','Fecha de validación')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('locked','Locked','Fecha de Bloqueo')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('deleted','Deleted','Fecha de Eliminación')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('generated','Generated','Fecha de Generación')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('uploaded','Uploaded','Fecha de Carga')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('initial','Initial','Fecha de Inicio')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('final','Final','Fecha de Fin')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('initial_validity','Inital Validity','Inicio de Vigencia')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('final_validity','Final Validity','Fin de Vigencia')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('contract_signed','Contract Signed','Firma de Contrato')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('transaction_date','Transaction Date','Fecha de Transacción')
INSERT INTO [entities].[point_in_time] ([code_name],[display_name],[display_name_es])
VALUES ('operation_date','Operation Date','Fecha de Operación')




-- INSERT INTO [entities].[event_type] ([code_name],[display_name],[description]) VALUES ('data.tenant.new', 'Data.Tenant.New', 'Event generated by adding a tenant in the system.');
INSERT INTO [entities].[event_type] ([code_name]) VALUES ('data.tenant.new');
INSERT INTO [entities].[event_type_localized] ([event_type_id],[language_id],[title_template],[summary_template]) 
    VALUES ((SELECT [event_type_id] FROM [entities].[event_type] WHERE [code_name] = 'data.tenant.new'), 1, 'Data.Tenant.Updated', 'Event generated by updating a tenant in the system.');