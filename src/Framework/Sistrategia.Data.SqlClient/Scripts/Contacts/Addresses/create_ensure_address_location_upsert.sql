-- ============================================================================
-- [contacts].[ensure_address_location_upsert]
-- 
-- Centralized stored procedure to ensure country, state, and city exist.
-- Creates missing entries and establishes parent-child relationships.
--
-- This procedure should be called by any parent entity that stores location
-- data (contacts, professional_jobs, organizations, etc.) to:
--   1. Avoid duplicating location upsert logic across multiple procedures
--   2. Ensure consistent parent-child relationships
--   3. Handle both catalog IDs and custom string values
--
-- Usage:
--   DECLARE @out_country_id INT, @out_state_id INT, @out_city_id INT
--   EXEC [contacts].[ensure_address_location_upsert]
--       @country_id = NULL,           -- Optional: if known, skip lookup
--       @country_name = N'México',    -- Used if country_id is NULL
--       @state_id = NULL,             -- Optional: if known, skip lookup
--       @state_name = N'Morelos',     -- Used if state_id is NULL
--       @city_id = NULL,              -- Optional: if known, skip lookup
--       @city_name = N'Cuernavaca',   -- Used if city_id is NULL
--       @out_country_id = @out_country_id OUTPUT,
--       @out_state_id = @out_state_id OUTPUT,
--       @out_city_id = @out_city_id OUTPUT
--
-- Author: Sistrategia
-- Date: 2026-01-02
-- ============================================================================

CREATE PROCEDURE [contacts].[ensure_address_location_upsert]
    -- Input: Either ID or Name for each level (ID takes precedence)
     @country_id INT = NULL
    ,@country_name NVARCHAR(256) = NULL
    ,@state_id INT = NULL
    ,@state_name NVARCHAR(256) = NULL
    ,@city_id INT = NULL
    ,@city_name NVARCHAR(256) = NULL
    -- Output: Resolved IDs (may be newly created or existing)
    ,@out_country_id INT OUTPUT
    ,@out_state_id INT OUTPUT
    ,@out_city_id INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    -- Initialize outputs to NULL
    SET @out_country_id = NULL;
    SET @out_state_id = NULL;
    SET @out_city_id = NULL;

    -- ========================================================================
    -- STEP 1: Resolve Country
    -- ========================================================================
    
    IF @country_id IS NOT NULL
    BEGIN
        -- Country ID provided - verify it exists
        IF EXISTS (SELECT [country_id] FROM [contacts].[country] WHERE [country_id] = @country_id)
        BEGIN
            SET @out_country_id = @country_id;
        END
        -- If ID doesn't exist, fall through to try by name
    END

    IF @out_country_id IS NULL AND @country_name IS NOT NULL AND LTRIM(RTRIM(@country_name)) <> ''
    BEGIN
        -- No valid ID - look up by name
        SELECT @out_country_id = [country_id]
        FROM [contacts].[country]
        WHERE [country] = LTRIM(RTRIM(@country_name));

        -- If country doesn't exist by name, create it
        IF @out_country_id IS NULL
        BEGIN
            INSERT INTO [contacts].[country] ([country])
            VALUES (LTRIM(RTRIM(@country_name)));

            SET @out_country_id = SCOPE_IDENTITY();
        END
    END

    -- ========================================================================
    -- STEP 2: Resolve State (requires Country)
    -- ========================================================================
    
    IF @state_id IS NOT NULL
    BEGIN
        -- State ID provided - verify it exists
        IF EXISTS (SELECT [state_id] FROM [contacts].[state] WHERE [state_id] = @state_id)
        BEGIN
            SET @out_state_id = @state_id;
            
            -- Also get the country from this state if we don't have it
            IF @out_country_id IS NULL
            BEGIN
                SELECT @out_country_id = [country_id]
                FROM [contacts].[state]
                WHERE [state_id] = @state_id;
            END
        END
    END

    IF @out_state_id IS NULL AND @state_name IS NOT NULL AND LTRIM(RTRIM(@state_name)) <> ''
    BEGIN
        -- No valid State ID - look up by name
        -- If we have a country, look within that country
        IF @out_country_id IS NOT NULL
        BEGIN
            SELECT @out_state_id = [state_id]
            FROM [contacts].[state]
            WHERE [state] = LTRIM(RTRIM(@state_name))
              AND [country_id] = @out_country_id;
        END
        ELSE
        BEGIN
            -- No country context - try to find any matching state
            -- (Pick the first one if multiple exist with same name)
            SELECT TOP 1 @out_state_id = [state_id], @out_country_id = [country_id]
            FROM [contacts].[state]
            WHERE [state] = LTRIM(RTRIM(@state_name))
            ORDER BY [state_id];
        END

        -- If state doesn't exist, create it (only if we have a country)
        IF @out_state_id IS NULL AND @out_country_id IS NOT NULL
        BEGIN
            INSERT INTO [contacts].[state] ([state], [country_id])
            VALUES (LTRIM(RTRIM(@state_name)), @out_country_id);

            SET @out_state_id = SCOPE_IDENTITY();
        END
    END

    -- ========================================================================
    -- STEP 3: Resolve City (requires State)
    -- ========================================================================
    
    IF @city_id IS NOT NULL
    BEGIN
        -- City ID provided - verify it exists
        IF EXISTS (SELECT [city_id] FROM [contacts].[city] WHERE [city_id] = @city_id)
        BEGIN
            SET @out_city_id = @city_id;
            
            -- Also get the state from this city if we don't have it
            IF @out_state_id IS NULL
            BEGIN
                SELECT @out_state_id = [state_id]
                FROM [contacts].[city]
                WHERE [city_id] = @city_id;
                
                -- And get the country from that state if needed
                IF @out_country_id IS NULL AND @out_state_id IS NOT NULL
                BEGIN
                    SELECT @out_country_id = [country_id]
                    FROM [contacts].[state]
                    WHERE [state_id] = @out_state_id;
                END
            END
        END
    END

    IF @out_city_id IS NULL AND @city_name IS NOT NULL AND LTRIM(RTRIM(@city_name)) <> ''
    BEGIN
        -- No valid City ID - look up by name
        -- If we have a state, look within that state
        IF @out_state_id IS NOT NULL
        BEGIN
            SELECT @out_city_id = [city_id]
            FROM [contacts].[city]
            WHERE [city] = LTRIM(RTRIM(@city_name))
              AND [state_id] = @out_state_id;
        END
        ELSE
        BEGIN
            -- No state context - try to find any matching city
            -- (Pick the first one if multiple exist with same name)
            SELECT TOP 1 
                @out_city_id = c.[city_id], 
                @out_state_id = c.[state_id],
                @out_country_id = COALESCE(@out_country_id, s.[country_id])
            FROM [contacts].[city] c
            INNER JOIN [contacts].[state] s ON c.[state_id] = s.[state_id]
            WHERE c.[city] = LTRIM(RTRIM(@city_name))
            ORDER BY c.[city_id];
        END

        -- If city doesn't exist, create it (only if we have a state)
        IF @out_city_id IS NULL AND @out_state_id IS NOT NULL
        BEGIN
            INSERT INTO [contacts].[city] ([city], [state_id])
            VALUES (LTRIM(RTRIM(@city_name)), @out_state_id);

            SET @out_city_id = SCOPE_IDENTITY();
        END
    END

    -- Return success (outputs are set via OUTPUT parameters)
    RETURN 0;
END


-- -- ============================================================================
-- -- Grant execute permissions (adjust as needed for your security model)
-- -- ============================================================================
-- -- GRANT EXECUTE ON [contacts].[ensure_address_location_upsert] TO [YourAppRole];
-- -- GO

-- PRINT 'Created [contacts].[ensure_address_location_upsert] stored procedure';
-- GO
