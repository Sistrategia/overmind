-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_contact_address_history_sync.sql
-- Created / Last Update: 2026-Sep-07. Version: 8.0.0.0. See ADR 0012.

-- Internal final snapshots for all live children touched in this unit, including shifted positions.
-- The writer owns the root lock. Committed history is never updated.
CREATE OR ALTER PROCEDURE [contacts].[contact_address_history_sync]
    @contact_id INT,
    @tenant_id INT,
    @dbrow_version BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC [data].[audit_unit_assert]
        @dbrow_version = @dbrow_version OUTPUT;
    DECLARE @rows TABLE (ordinal INT PRIMARY KEY, address_id INT, location_id INT,
        is_public BIT, display_order INT, born BIGINT, prior_op INT);
    INSERT @rows
    SELECT c.ordinal,c.address_id,c.location_id,c.is_public,c.display_order,i.created_version,p.dboperation_type_id
    FROM [contacts].[contact_address] c
    JOIN [contacts].[contact_address_identity] i ON i.contact_id=c.contact_id AND i.ordinal=c.ordinal
    OUTER APPLY (SELECT TOP(1) h.dboperation_type_id FROM [contacts].[contact_address_history] h
        WHERE h.contact_id=c.contact_id AND h.ordinal=c.ordinal AND h.dbrow_version<@dbrow_version
        ORDER BY h.dbrow_version DESC) p
    WHERE c.contact_id=@contact_id AND c.tenant_id=@tenant_id AND c.dbrow_version=@dbrow_version;
    IF EXISTS (SELECT 1 FROM @rows r
        OUTER APPLY (SELECT TOP(1) a.operation FROM [contacts].[contact_address_action] a
            WHERE a.contact_id=@contact_id AND a.ordinal=r.ordinal AND a.dbrow_version=r.born ORDER BY a.action_ordinal DESC) a
        WHERE r.born<>@dbrow_version AND r.prior_op IS NULL AND COALESCE(a.operation,'')<>'delete')
    BEGIN
        THROW 51909, 'Address identity has incomplete prior history.',1;
    END

    UPDATE h SET dboperation_type_id=CASE WHEN r.prior_op IN (1,2) THEN 2 ELSE 1 END,
        address_id=r.address_id,location_id=r.location_id,is_public=r.is_public,display_order=r.display_order
    FROM [contacts].[contact_address_history] h JOIN @rows r ON r.ordinal=h.ordinal
    WHERE h.contact_id=@contact_id AND h.tenant_id=@tenant_id AND h.dbrow_version=@dbrow_version;
    INSERT [contacts].[contact_address_history]
        (dbrow_version,tenant_id,dboperation_type_id,contact_id,ordinal,address_id,location_id,is_public,display_order)
    SELECT @dbrow_version,@tenant_id,CASE WHEN r.prior_op IN (1,2) THEN 2 ELSE 1 END,
        @contact_id,r.ordinal,r.address_id,r.location_id,r.is_public,r.display_order
    FROM @rows r WHERE NOT EXISTS (SELECT 1 FROM [contacts].[contact_address_history] h
        WHERE h.contact_id=@contact_id AND h.ordinal=r.ordinal AND h.dbrow_version=@dbrow_version);
END;
