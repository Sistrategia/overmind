-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_web_link_history_sync.sql
-- Created / Last Update: 2026-Sep-07. See ADR 0011.
-- Version: 8.0.0.0.

-- Internal final snapshots for all live children touched in this unit, including shifted positions.
-- The writer owns the root lock. Committed history is never updated.
CREATE OR ALTER PROCEDURE [contacts].[contact_web_link_history_sync]
    @contact_id INT,
    @tenant_id INT,
    @dbrow_version BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC [data].[audit_unit_assert]
        @dbrow_version = @dbrow_version OUTPUT;
    DECLARE @rows TABLE (ordinal INT PRIMARY KEY, web_link_id INT, location_id INT,
        link_type NVARCHAR(50), display_text NVARCHAR(256), is_public BIT, display_order INT, born BIGINT, prior_op INT);
    INSERT @rows
    SELECT c.ordinal,c.web_link_id,c.location_id,c.link_type,c.display_text,c.is_public,c.display_order,i.created_version,p.dboperation_type_id
    FROM [contacts].[contact_web_link] c
    JOIN [contacts].[contact_web_link_identity] i ON i.contact_id=c.contact_id AND i.ordinal=c.ordinal
    OUTER APPLY (SELECT TOP(1) h.dboperation_type_id FROM [contacts].[contact_web_link_history] h
        WHERE h.contact_id=c.contact_id AND h.ordinal=c.ordinal AND h.dbrow_version<@dbrow_version
        ORDER BY h.dbrow_version DESC) p
    WHERE c.contact_id=@contact_id AND c.tenant_id=@tenant_id AND c.dbrow_version=@dbrow_version;
    IF EXISTS (SELECT 1 FROM @rows r
        OUTER APPLY (SELECT TOP(1) a.operation FROM [contacts].[contact_web_link_action] a
            WHERE a.contact_id=@contact_id AND a.ordinal=r.ordinal AND a.dbrow_version=r.born ORDER BY a.action_ordinal DESC) a
        WHERE r.born<>@dbrow_version AND r.prior_op IS NULL AND COALESCE(a.operation,'')<>'delete')
    BEGIN
        THROW 51809, 'Web link identity has incomplete prior history.',1;
    END

    UPDATE h SET dboperation_type_id=CASE WHEN r.prior_op IN (1,2) THEN 2 ELSE 1 END,
        web_link_id=r.web_link_id,location_id=r.location_id,link_type=r.link_type,display_text=r.display_text,is_public=r.is_public,display_order=r.display_order
    FROM [contacts].[contact_web_link_history] h JOIN @rows r ON r.ordinal=h.ordinal
    WHERE h.contact_id=@contact_id AND h.tenant_id=@tenant_id AND h.dbrow_version=@dbrow_version;
    INSERT [contacts].[contact_web_link_history]
        (dbrow_version,tenant_id,dboperation_type_id,contact_id,ordinal,web_link_id,location_id,link_type,display_text,is_public,display_order)
    SELECT @dbrow_version,@tenant_id,CASE WHEN r.prior_op IN (1,2) THEN 2 ELSE 1 END,
        @contact_id,r.ordinal,r.web_link_id,r.location_id,r.link_type,r.display_text,r.is_public,r.display_order
    FROM @rows r WHERE NOT EXISTS (SELECT 1 FROM [contacts].[contact_web_link_history] h
        WHERE h.contact_id=@contact_id AND h.ordinal=r.ordinal AND h.dbrow_version=@dbrow_version);
END;
