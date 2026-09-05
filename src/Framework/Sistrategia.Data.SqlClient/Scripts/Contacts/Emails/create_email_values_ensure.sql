-- Exact accepted UTF-16 bytes: case, accents and trailing spaces remain distinct.
-- Read-first on a hit; locking recheck on a miss. Unique binary keys are the final boundary.
CREATE OR ALTER PROCEDURE [contacts].[email_values_ensure]
    @email_address NVARCHAR(MAX), @location_name NVARCHAR(MAX),
    @email_id INT OUTPUT, @location_id INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    IF XACT_STATE() <> 1 THROW 51001, 'Catalog writes require a committable transaction.', 1;
    IF @email_address IS NULL OR DATALENGTH(@email_address)=0 OR DATALENGTH(@email_address)>512
        THROW 51300, 'Email must contain 1 to 256 UTF-16 code units.', 1;
    IF DATALENGTH(@location_name)>200 THROW 51301, 'Email location exceeds 100 UTF-16 code units.', 1;
    SET @email_id = NULL; SET @location_id = NULL;
    DECLARE @email_key VARBINARY(512)=CONVERT(VARBINARY(512),@email_address),
        @location_key VARBINARY(200)=CONVERT(VARBINARY(200),@location_name);
    SELECT @email_id=[email_id] FROM [contacts].[email] WHERE [value_key]=@email_key AND [value_length]=DATALENGTH(@email_address);
    IF @email_id IS NULL
    BEGIN
        SELECT @email_id=[email_id] FROM [contacts].[email] WITH (UPDLOCK,HOLDLOCK) WHERE [value_key]=@email_key AND [value_length]=DATALENGTH(@email_address);
        IF @email_id IS NULL
        BEGIN
            INSERT [contacts].[email] ([email_address]) VALUES (@email_address);
            SET @email_id=CONVERT(INT,SCOPE_IDENTITY());
        END;
    END;
    IF @location_name IS NOT NULL
    BEGIN
        SELECT @location_id=[location_id] FROM [contacts].[email_location] WHERE [value_key]=@location_key AND [value_length]=DATALENGTH(@location_name);
        IF @location_id IS NULL
        BEGIN
            SELECT @location_id=[location_id] FROM [contacts].[email_location] WITH (UPDLOCK,HOLDLOCK) WHERE [value_key]=@location_key AND [value_length]=DATALENGTH(@location_name);
            IF @location_id IS NULL
            BEGIN
                INSERT [contacts].[email_location] ([location_name]) VALUES (@location_name);
                SET @location_id=CONVERT(INT,SCOPE_IDENTITY());
            END;
        END;
    END;
END;
