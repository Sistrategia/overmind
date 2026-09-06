-- Move the stable child identity to a 1-based position. Position 1 is the default/principal.
CREATE OR ALTER PROCEDURE [contacts].[email_move]
    @contact_public_key UNIQUEIDENTIFIER, @modified_by UNIQUEIDENTIFIER,
    @ordinal INT, @display_order INT, @expected_entity_version INT,
    @tenant UNIQUEIDENTIFIER=NULL, @dbrow_version BIGINT=NULL OUTPUT,
    @entity_version INT=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC [contacts].[contact_email_change] @operation='move',@contact_public_key=@contact_public_key,
        @actor=@modified_by,@tenant=@tenant,@expected_entity_version=@expected_entity_version,
        @ordinal=@ordinal,@display_order=@display_order,@dbrow_version=@dbrow_version OUTPUT,
        @entity_version=@entity_version OUTPUT;
END;
