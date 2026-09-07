-- Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
-- Licensed under Apache-2.0. See LICENSE in the project root.
-- Script: create_login_name_is_valid.sql
-- Part of the Sistrategia.Security Framework.
-- Last Update: 2026-Sep-07
-- Created: 2026-Sep-07
-- Version: 8.0.0.0

-- Validation only; equality is the fixed CI/AS/KS/WS/SC login column collation.
CREATE OR ALTER FUNCTION [security].[login_name_is_valid] (@value NVARCHAR(MAX))
RETURNS BIT
WITH SCHEMABINDING
AS
BEGIN
    IF @value IS NULL OR DATALENGTH(@value) = 0 OR DATALENGTH(@value) > 512
    BEGIN
        RETURN 0;
    END

    DECLARE @position INT = 1, @code INT;
    WHILE @position <= DATALENGTH(@value) / 2
    BEGIN
        SET @code = UNICODE(SUBSTRING(@value COLLATE Latin1_General_100_BIN2, @position, 1));
        IF @code <= 32 OR @code BETWEEN 127 AND 160 OR @code = 5760
            OR @code BETWEEN 8192 AND 8203 OR @code IN (8232, 8233, 8239, 8287, 12288, 65279)
        BEGIN
            RETURN 0;
        END
        SET @position += 1;
    END
    RETURN 1;
END;
