-- Optional INOUT outputs describe uncommitted work until the outer owner commits.
-- Update/restore replace all association fields; NULL location clears it.
CREATE OR ALTER PROCEDURE [contacts].[contact_email_insert]
    @contact_public_key UNIQUEIDENTIFIER, @created_by UNIQUEIDENTIFIER,
    @tenant UNIQUEIDENTIFIER=NULL, @expected_entity_version INT=NULL,
    @email_address NVARCHAR(MAX)=NULL, @location_name NVARCHAR(MAX)=NULL, @is_public BIT=0,
    @ordinal INT=NULL OUTPUT, @dbrow_version BIGINT=NULL OUTPUT,
    @entity_version INT=NULL OUTPUT, @email_id INT=NULL OUTPUT, @supress_event_message BIT=0
AS
BEGIN
    SET NOCOUNT ON;
    EXEC [contacts].[contact_email_change] 'insert',@contact_public_key,@created_by,@tenant,@expected_entity_version,
        @email_address,@location_name,@is_public,@ordinal OUTPUT,@dbrow_version OUTPUT,@entity_version OUTPUT,@email_id OUTPUT,@supress_event_message;
END;
