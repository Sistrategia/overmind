-- Private account-creation payload; excludes hashes, salts, security tokens and login telemetry.
CREATE OR ALTER PROCEDURE [security].[user_history_create]
    @user_id INT, @tenant_id INT, @dbrow_version BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC [data].[audit_unit_assert] @dbrow_version OUTPUT;
    IF NOT EXISTS (SELECT 1 FROM [entities].[entity] e
        JOIN [entities].[entity_type] t ON t.entity_type_id=e.entity_type_id AND t.code_name=N'user'
        JOIN [entities].[entity_version_history] h ON h.entity_id=e.entity_id AND h.tenant_id=e.tenant_id
            AND h.entity_version=e.entity_version AND h.dbrow_version=e.dbrow_version
        JOIN [security].[user] u ON u.user_id=e.entity_id
        WHERE e.entity_id=@user_id AND e.tenant_id=@tenant_id AND e.dbrow_version=@dbrow_version)
        THROW 51604,'User creation history requires this unit''s user root, subtype and spine.',1;
    INSERT [security].[user_history] (dbrow_version,tenant_id,user_id,dboperation_type_id,
        login_name,email,email_confirmed,phone_number,phone_number_confirmed,two_factor_enabled,lockout_end,lockout_enabled)
    SELECT @dbrow_version,@tenant_id,user_id,1,login_name,email,email_confirmed,
        phone_number,phone_number_confirmed,two_factor_enabled,lockout_end,lockout_enabled
    FROM [security].[user] WHERE user_id=@user_id;
END;
