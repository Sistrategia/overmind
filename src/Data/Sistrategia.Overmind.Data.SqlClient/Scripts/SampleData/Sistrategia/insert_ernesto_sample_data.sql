-- The builder runs this business batch through RunLocalStoredAuditCommands, which owns and enrolls
-- its transaction. A direct standalone user_insert call owns/enrolls its own transaction.

DECLARE @RC INT
DECLARE @batch_id INT
DECLARE @tenant UNIQUEIDENTIFIER
DECLARE @public_key UNIQUEIDENTIFIER
DECLARE @created_by UNIQUEIDENTIFIER
DECLARE @created DATETIME2
DECLARE @dbrow_version BIGINT

SET @batch_id = 1
-- SET @tenant = '46BE0A72-4301-4F02-9EBD-6EEBA985B746'
SET @tenant = '908E5A8C-0372-4EDC-ADDF-011E059091ED'

SET @public_key = '97A45AEE-EF87-4EFF-98D5-E51195A6669A'
SET @created_by = '97A45AEE-EF87-4EFF-98D5-E51195A6669A'
SET @created = '2022-01-04 21:00:00.000'
SET @dbrow_version = NULL

EXECUTE @RC = [security].[user_insert] 
    @public_key     = @public_key -- @created_by
    ,@tenant        = @tenant
    ,@logical_key	= '97570018' -- 'eocampo'
	,@display_name  = 'José Ernesto Ocampo Cicero'
 	,@created 		= '2022-01-04 21:00:00.000'
	,@created_by 	= @created_by -- '97A45AEE-EF87-4EFF-98D5-E51195A6669A'

    ,@summary 		= 'Soy egresado de la Universidad La Salle Cuernavaca y fundador de mi propia empresa de desarrollo de software. Durante más de dos décadas he trabajado en la industria de tecnologías de la información, combinando la parte técnica con la consultoría y la dirección de equipos multidisciplinarios.

Mi pasión está en crear entornos de trabajo colaborativos y creativos, donde el talento de cada persona se potencia para lograr resultados de alto impacto. He tenido la oportunidad de participar en proyectos internacionales y de gobierno, así como de acompañar a empresas en procesos de innovación y transformación tecnológica.

Creo firmemente que la formación continua y la vinculación entre egresados, empresas y universidades son la base para construir oportunidades y fortalecer a nuestra comunidad profesional.'

	,@image_url 	= 'https://ulsaclrs1.blob.core.windows.net/public/97a45aeeef874eff98d5e51195a6669a_540.jpg'
	,@thumbnail_url = 'https://ulsaclrs1.blob.core.windows.net/public/97a45aeeef874eff98d5e51195a6669a_64.jpg'
	,@is_private 	= 0
    ,@login_name 	= 'ernesto@sistrategia.com'
	,@full_name 	= 'José Ernesto Ocampo Cicero'
--	,@role_name 	= NULL 
	,@person_title	= 'Ing.'
	,@person_first_name = 'José Ernesto'
--  ,@person_last_name  = 'Ocampo Cicero'
	,@person_last_name1	= 'Ocampo'
	,@person_last_name2	= 'Cicero'
    ,@person_suffix     = NULL
    ,@person_alias      = 'Ernesto'
	-- ,@person_job_title	= 'Software Architect'
    ,@person_job_title	= 'CEO | CTO | Co-Founder' -- 'Arquitecto de Sistemas'
	,@person_company	= 'Sistrategia'

    ,@person_gender_code =  'M'
	,@person_birth_date = '1977-12-04'
    ,@person_marital_status = 'M'

	,@password_hash     = 'AKKgixLc6QiaRaJSj/oWP6laNnWm5LYLEVXTikPcRak/E3s7llyDtmD1hdp3v7fIZw=='
--	,@security_stamp    = NULL
    ,@password_salt     = NULL

    ,@email_location_name = 'Principal'
	,@email 	        = 'ernesto@sistrategia.com'

    ,@phone_location_name = 'Celular'
	,@phone_number      = '328-8894'
    ,@phone_area_code   = '777'
    ,@phone_extension   = NULL
    ,@numbers_only      = '7773288894'
    ,@full_phone        = '(777) 328-8894'

    ,@address_location_name = 'Oficina'
    ,@address1          = 'Tabachin #12' -- TABACHIN #12
    ,@address2          = 'Col. Bellavista' -- BELLA VISTA
    ,@zip_code          = '62130' -- 62170 
    ,@city              = 'Cuernavaca'
    ,@state             = 'Morelos'
    ,@country           = 'México'

	,@dbrow_version     = NULL 	
    ,@auto_create_person_company = 0
            

-- EXECUTE @RC = [entities].[identifier_insert] 
--  	@entity_public_key = @public_key
--     ,@key = 'studentid'
--     ,@value = '97570018' 
--     ,@from_date = '2024-01-14 22:40:10.5830000'

-- EXECUTE @RC = [entities].[identifier_insert] 
--  	@entity_public_key = @public_key
--     ,@key = 'razonsocial'    
--     ,@value = 'JOSE ERNESTO OCAMPO CICERO'
--     ,@from_date = '2022-01-04 21:00:00.0000000'    

-- EXECUTE @RC = [entities].[identifier_insert] 
--  	@entity_public_key = @public_key
--     ,@key = 'rfc'    
--     ,@value = 'OACE7712047G0'
--     ,@from_date = '2022-01-04 21:00:00.0000000'

-- EXECUTE @RC = [entities].[identifier_insert] 
--  	@entity_public_key = @public_key
--     ,@key = 'vatid'    
--     ,@value = 'OACE7712047G0'
--     ,@from_date = '2022-01-04 21:00:00.0000000'

-- EXECUTE @RC = [entities].[identifier_insert] 
--  	@entity_public_key = @public_key
--     ,@key = 'curp'
--     ,@value = 'OACE771204HMSCCR03'
--     ,@from_date = '2022-01-04 21:00:00.0000000'

-- EXECUTE @RC = [entities].[identifier_insert] 
--     @entity_public_key = @public_key
--     ,@key = 'cedula.numero'
--     ,@value = '4521708'
--     ,@from_date = '2024-01-14 22:40:10.5830000'

INSERT INTO [security].[user_role] ([user_id],[role_id]) VALUES (
            (SELECT [entity_id] FROM [entities].[entity] WHERE [public_key] = @public_key),
            (SELECT [role_id] FROM [security].[role] WHERE [role_name] = 'Developer' AND [tenant_id] IS NULL))
            -- (SELECT [role_id] FROM [security].[role] WHERE [role_name] = 'Customer' AND [tenant_id] IS NULL))




-- -- INSERT INTO [entities].[identifier] ([identifier_value]) VALUES ('OACE7712047G0')
-- -- INSERT INTO [entities].[identifier] ([identifier_value]) VALUES ('OACE771204HMSCCR03')
-- -- INSERT INTO [entities].[entity_identifiers] ([entity_id], [identifier_type_id], [identifier_id], [from_date]) VALUES (2, 1, 1, '2022-01-04 21:00:00.0000000')
-- -- INSERT INTO [entities].[entity_identifiers] ([entity_id], [identifier_type_id], [identifier_id], [from_date]) VALUES (2, 2, 1, '2022-01-04 21:00:00.0000000')
-- -- INSERT INTO [entities].[entity_identifiers] ([entity_id], [identifier_type_id], [identifier_id], [from_date]) VALUES (2, 3, 2, '2022-01-04 21:00:00.0000000')

-- DECLARE @document_type_id INT
-- SET @document_type_id = (SELECT [document_type_id] FROM [documents].[document_type] WHERE [code_name] = 'mxcif')

-- EXECUTE @RC = [documents].[document_insert] @document_type_id, '3DB29AAD-7217-453E-B12A-F86CD11D7D3B', @tenant
--             , 'OACE7712047G0', 'Constancia de Situación Fiscal'
--             , '2022-01-04 21:00:00.0000000', @created_by
--             , 'Constancia de Situación Fiscal' -- Summary ~/Content/Img/sistrategia.png	~/Content/Img/sistrategia_48.png
--             , NULL --  image_url
--             , NULL --  thumbnail_url
--             , 0            
--             , 'Constancia de Situación Fiscal', 'Constancia de Situación Fiscal','OACE7712047G0-CIF.PDF'
--             ,'application/pdf' -- [content_type]
--             , 153121 -- [content_length] -- 153121 COntentType: 
--             ,'PDF'
--             , 'https://devcdn1.blob.core.windows.net/legit-dev/202212_CIF_OACE.pdf' -- [storage_url]
--             , 1 -- storage_provider_id
--             ,'V'
--             , NULL -- dbrow_version     

-- EXECUTE @RC = [entities].[identifier_insert] 
--  	@entity_public_key = '3DB29AAD-7217-453E-B12A-F86CD11D7D3B'
--     ,@key = 'idcif'
--     ,@label = 'idCIF'
--     ,@value = '15020279010'
--     ,@from_date = '2022-01-04 21:00:00.0000000'

-- EXECUTE @RC = [entities].[identifier_insert] 
--  	@entity_public_key = '3DB29AAD-7217-453E-B12A-F86CD11D7D3B'
--     ,@key = 'rfc'    
--     ,@value = 'OACE7712047G0'
--     ,@from_date = '2022-01-04 21:00:00.0000000'

-- EXECUTE @RC = [entities].[identifier_insert] 
--  	@entity_public_key = '3DB29AAD-7217-453E-B12A-F86CD11D7D3B'
--     ,@key = 'razonsocial'    
--     ,@value = 'JOSE ERNESTO OCAMPO CICERO'
--     ,@from_date = '2022-01-04 21:00:00.0000000'    

-- EXECUTE @RC = [entities].[identifier_insert] 
--  	@entity_public_key = '3DB29AAD-7217-453E-B12A-F86CD11D7D3B'
--     ,@key = 'curp'
--     ,@value = 'OACE771204HMSCCR03'
--     ,@from_date = '2022-01-04 21:00:00.0000000'

-- INSERT INTO [documents].[document_form_data] ([document_id], [json_data]) VALUES (
-- 	(SELECT [document_id] FROM [documents].[document_view] WHERE [public_key] = '3DB29AAD-7217-453E-B12A-F86CD11D7D3B'),
-- 	'{"formdata":' + 
-- 	'[' 
-- 	+ '{"key":"title","label":"Título","value":"CONSTANCIA DE SITUACIÓN FISCAL"}'
-- 	+ ',{"key":"rfc","label":"RFC","value":"OACE7712047G0"}'
-- 	+ ',{"key":"razonsocial","label":"Razón Social","value":"JOSE ERNESTO OCAMPO CICERO"}'
-- 	+ ',{"key":"curp","label":"CURP","value":"OACE771204HMSCCR03"}'    
--     + ',{"key":"fecha.emision","label":"Fecha de Emisión","value":"2022-12-29"}'
--     + ',{"key":"idcif","label":"idCIF","value":"15020279010"}'
-- 	+ ',{"key":"person.firstname","label":"Nombre(s)","value":"JOSE ERNESTO"}'	
--     + ',{"key":"person.lastname1","label":"Primer Apellido","value":"OCAMPO"}'	
--     + ',{"key":"person.lastname2","label":"Segundo Apellido","value":"CICERO"}'	
--     + ',{"key":"fechainiciooperaciones","label":"Fecha de Inicio de operaciones","value":"19 DE MAYO DE 2003"}'	
--     + ',{"key":"estatuspadron","label":"Estatus en el padrón","value":"REACTIVADO"}'	
--     + ',{"key":"fechaultimocambio","label":"Fecha de último cambio de estado","value":"15 DE ENERO DE 2005"}'	
--     + ',{"key":"nombrecomercial","label":"Nombre Comercial","value":""}'	
--     + ',{"key":"domicilio.cp","label":"Código Postal","value":"62140"}'
--     + ',{"key":"domicilio.tipovialidad","label":"Tipo de Vialidad","value":""}'
--     + ',{"key":"domicilio.nombre","label":"Nombre de Vialidad","value":"TABACHIN"}'
--     + ',{"key":"domicilio.extnum","label":"Número Exterior","value":"12"}'
--     + ',{"key":"domicilio.intnum","label":"Número Interior","value":""}'
--     + ',{"key":"domicilio.colonia","label":"Nombre de la Colonia","value":"BELLAVISTA"}'
--     + ',{"key":"domicilio.localidad","label":"Nombre de la Localidad","value":""}'
--     + ',{"key":"domicilio.municipio","label":"Nombre del Municipio o Demarcación Territoria","value":"CUERNAVACA"}'
--     + ',{"key":"domicilio.entidadfederativa","label":"Nombre de la Entidad Federativa","value":"Morelos"}'
--     + ',{"key":"actividad.economica","label":"Actividad Económica","value":"Servicios de consultoría en computación"}'
--     + ',{"key":"regimenfiscal","label":"Régimen","value":"Régimen de las Personas Físicas con Actividades Empresariales y Profesionales"}'
-- 	+']'
-- 	+'}'
-- 	);

-- INSERT INTO [entities].[entity_metadata] ([entity_id], [json_data]) VALUES (
-- 	(SELECT [document_id] FROM [documents].[document_view] WHERE [public_key] = '3DB29AAD-7217-453E-B12A-F86CD11D7D3B'),
-- 	'{"metadata":' + 
-- 	'[' 
--     + '{"key":"title","label":"Título","value":"CONSTANCIA DE SITUACIÓN FISCAL"}'
-- 	+ ',{"key":"rfc","label":"RFC","value":"OACE7712047G0"}'
-- 	+ ',{"key":"razonsocial","label":"Razón Social","value":"JOSE ERNESTO OCAMPO CICERO"}'
-- 	+ ',{"key":"curp","label":"CURP","value":"OACE771204HMSCCR03"}'
--     + ',{"key":"cp","label":"Código Postal","value":"62140"}'
--     + ',{"key":"fecha.emision","label":"Fecha de Emisión","value":"2022-12-29"}'
--     + ',{"key":"idcif","label":"idCIF","value":"15020279010"}'
-- 	+']'
-- 	+'}'
-- 	);

-- INSERT INTO [documents].[contact_document] ([contact_id],[document_id],[contact_document_role_id],[from_date],[to_date],[status]) 
-- 	VALUES ((SELECT [contact_id] FROM [contacts].[contact_view] WHERE [public_key] = @public_key),
-- 		(SELECT [document_id] FROM [documents].[document_view] WHERE [logical_key] = 'OACE7712047G0') -- 7-07-12-845 PROPIMEX		
-- 		,(SELECT [contact_document_role_id] FROM [documents].[contact_document_role] WHERE [code_name] = 'owner')
-- 		,'2021-07-01 10:00:00.0000000', '2021-06-30 10:00:00.0000000', 'V'
-- 	)       

-- -- INSERT INTO [documents].[document] ([document_type_id],[logical_key],[name],[description],[original_name]
-- --     ,[content_type],[content_length],[thumbnail_url],[file_extension],[storage_url]
-- --     ,[storage_provider_id],[status])
-- --     VALUES (1,'OACE7712047G0','Constancia de Situación Fiscal','Constancia de Situación Fiscal','OACE7712047G0-CIF.PDF'
-- --     ,'application/pdf' -- [content_type]
-- --     , 153121 -- [content_length] -- 153121 COntentType: 
-- --     , NULL,'PDF'
-- --     , 'https://devcdn1.blob.core.windows.net/legit-dev/202212_CIF_OACE.pdf' -- [storage_url]
-- --     , 1,'V')
-- -- INSERT INTO [documents].[contact_document] ([contact_id],[document_id],[contact_document_role_id],[from_date],[to_date],[status]) 
-- --     VALUES (2,1
-- --     ,(SELECT [contact_document_role_id] FROM [documents].[contact_document_role] WHERE [code_name] = 'owner')
-- --     ,'2022-01-04 21:00:00.0000000',NULL, 'V')

-- SET @public_key = '54D4F2DA-F6E1-4E66-A6DD-AD84B2E3C880'

-- EXECUTE @RC = [documents].[document_insert] @document_type_id, 'BEEBAA46-2170-4753-8522-6831023A0486', @tenant
--             , 'JEO110617QB7', 'Constancia de Situación Fiscal'
--             , '2022-01-04 21:00:00.0000000', @created_by
--             , 'Constancia de Situación Fiscal' -- Summary ~/Content/Img/sistrategia.png	~/Content/Img/sistrategia_48.png
--             , NULL --  image_url
--             , NULL --  thumbnail_url
--             , 0            
--             , 'Constancia de Situación Fiscal', 'Constancia de Situación Fiscal','JEO110617QB7-CIF.PDF'
--             ,'application/pdf' -- [content_type]
--             , 153323 -- [content_length] -- 153121 COntentType: 
--             ,'PDF'
--             , 'https://devcdn1.blob.core.windows.net/legit-dev/202212_CIF_JEOCSI.pdf' -- [storage_url]
--             , 1 -- storage_provider_id
--             ,'V'
--             , NULL -- dbrow_version    

-- EXECUTE @RC = [entities].[identifier_insert] 
--  	@entity_public_key = 'BEEBAA46-2170-4753-8522-6831023A0486'
--     ,@key = 'idcif'
--     ,@label = 'idCIF'
--     ,@value = '14110781462'
--     ,@from_date = '2022-12-29 21:00:00.0000000'

-- EXECUTE @RC = [entities].[identifier_insert] 
--  	@entity_public_key = 'BEEBAA46-2170-4753-8522-6831023A0486'
--     ,@key = 'rfc'    
--     ,@value = 'JEO110617QB7'
--     ,@from_date = '2022-12-29 21:00:00.0000000'

-- EXECUTE @RC = [entities].[identifier_insert] 
--  	@entity_public_key = 'BEEBAA46-2170-4753-8522-6831023A0486'
--     ,@key = 'razonsocial'    
--     ,@value = 'JEOCSI'
--     ,@from_date = '2022-12-29 21:00:00.0000000'    

-- -- EXECUTE @RC = [entities].[identifier_insert] 
-- --  	@entity_public_key = 'BEEBAA46-2170-4753-8522-6831023A0486'
-- --     ,@key = 'curp'
-- --     ,@value = 'OACE771204HMSCCR03'
-- --     ,@from_date = '2022-01-04 21:00:00.0000000'
