-- Assign the trusted application's database user to this role at deployment.
-- Deployment-owned: DropSchema preserves this role and its memberships; creation reapplies object grants.
-- Authentication and contact-level authorization happen before supplying actor/tenant context.
-- Do not combine this role with ownership, impersonation, or module-alter privileges.
IF DATABASE_PRINCIPAL_ID(N'email_runtime') IS NULL CREATE ROLE [email_runtime] AUTHORIZATION [dbo];
GRANT EXECUTE ON [data].[audit_unit_begin] TO [email_runtime];
GRANT EXECUTE ON [contacts].[contact_email_change] TO [email_runtime];
GRANT EXECUTE ON [contacts].[contact_email_insert] TO [email_runtime];
GRANT EXECUTE ON [contacts].[email_update] TO [email_runtime];
GRANT EXECUTE ON [contacts].[email_delete] TO [email_runtime];
GRANT EXECUTE ON [contacts].[email_restore] TO [email_runtime];
GRANT EXECUTE ON [contacts].[email_move] TO [email_runtime];
GRANT EXECUTE ON [contacts].[contact_email_read] TO [email_runtime];
DENY SELECT,INSERT,UPDATE,DELETE ON SCHEMA::[data] TO [email_runtime];
DENY SELECT,INSERT,UPDATE,DELETE ON SCHEMA::[entities] TO [email_runtime];
DENY SELECT,INSERT,UPDATE,DELETE ON SCHEMA::[contacts] TO [email_runtime];
DENY SELECT,INSERT,UPDATE,DELETE ON SCHEMA::[security] TO [email_runtime];
DENY EXECUTE ON [data].[audit_unit_assert] TO [email_runtime];
DENY EXECUTE ON [data].[audit_isolation_assert] TO [email_runtime];
DENY EXECUTE ON [data].[dbrow_version_ensure] TO [email_runtime];
DENY EXECUTE ON [data].[audit_action_next] TO [email_runtime];
DENY EXECUTE ON [data].[tenant_insert] TO [email_runtime];
DENY EXECUTE ON [entities].[actor_resolve] TO [email_runtime];
DENY EXECUTE ON [entities].[entity_write_lock] TO [email_runtime];
DENY EXECUTE ON [entities].[entity_version_bump] TO [email_runtime];
DENY EXECUTE ON [entities].[entity_history_snapshot] TO [email_runtime];
DENY EXECUTE ON [contacts].[email_values_ensure] TO [email_runtime];
DENY EXECUTE ON [contacts].[contact_email_write] TO [email_runtime];
DENY EXECUTE ON [contacts].[contact_email_history_sync] TO [email_runtime];
DENY EXECUTE ON [contacts].[contact_company_lookup] TO [email_runtime];
DENY EXECUTE ON [security].[system_user_bootstrap] TO [email_runtime];
DENY EXECUTE ON [security].[user_history_create] TO [email_runtime];
-- Legacy constructors retain separate compatibility/authorization work; this profile does not expose them.
DENY EXECUTE ON [entities].[entity_insert] TO [email_runtime];
DENY EXECUTE ON [contacts].[contact_insert] TO [email_runtime];
DENY EXECUTE ON [security].[user_insert] TO [email_runtime];

-- Phone capability is opt-in; existing email principals retain their original surface.
IF DATABASE_PRINCIPAL_ID(N'contact_channels_runtime') IS NULL CREATE ROLE [contact_channels_runtime] AUTHORIZATION [dbo];
IF NOT EXISTS (SELECT 1 FROM sys.database_role_members WHERE role_principal_id=DATABASE_PRINCIPAL_ID(N'email_runtime') AND member_principal_id=DATABASE_PRINCIPAL_ID(N'contact_channels_runtime'))
    ALTER ROLE [email_runtime] ADD MEMBER [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[contact_phone_change] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[contact_phone_insert] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[phone_update] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[phone_delete] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[phone_restore] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[phone_move] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[contact_phone_read] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[contact_channels_read] TO [contact_channels_runtime];
DENY EXECUTE ON [contacts].[contact_channels_read_core] TO [email_runtime];
DENY EXECUTE ON [contacts].[contact_email_read_rows] TO [email_runtime];
DENY EXECUTE ON [contacts].[contact_phone_read_rows] TO [email_runtime];
DENY EXECUTE ON [contacts].[contact_phone_write] TO [email_runtime];
DENY EXECUTE ON [contacts].[contact_phone_history_sync] TO [email_runtime];
DENY EXECUTE ON [contacts].[phone_values_ensure] TO [email_runtime];

-- The contact-channel capability includes web links; email-only capability remains unchanged.
DENY EXECUTE ON [contacts].[web_link_values_ensure] TO [email_runtime];
DENY EXECUTE ON [contacts].[contact_web_link_history_sync] TO [email_runtime];
DENY EXECUTE ON [contacts].[contact_web_link_write] TO [email_runtime];
GRANT EXECUTE ON [contacts].[contact_web_link_change] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[contact_web_link_insert] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[web_link_update] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[web_link_delete] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[web_link_restore] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[web_link_move] TO [contact_channels_runtime];
DENY EXECUTE ON [contacts].[contact_web_link_read_rows] TO [email_runtime];
GRANT EXECUTE ON [contacts].[contact_web_link_read] TO [contact_channels_runtime];

-- Address capability shares the trusted contact-channel boundary.
GRANT EXECUTE ON [contacts].[contact_address_change] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[contact_address_insert] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[address_update] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[address_delete] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[address_restore] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[address_move] TO [contact_channels_runtime];
GRANT EXECUTE ON [contacts].[contact_address_read] TO [contact_channels_runtime];
DENY EXECUTE ON [contacts].[contact_address_write] TO [email_runtime];
DENY EXECUTE ON [contacts].[contact_address_read_rows] TO [email_runtime];
DENY EXECUTE ON [contacts].[contact_address_history_sync] TO [email_runtime];
DENY EXECUTE ON [contacts].[address_values_ensure] TO [email_runtime];
DENY EXECUTE ON [contacts].[address_geography_resolve] TO [email_runtime];
DENY EXECUTE ON [contacts].[ensure_address_location_upsert] TO [email_runtime];
DENY EXECUTE ON [contacts].[country_value_ensure] TO [email_runtime];
DENY EXECUTE ON [contacts].[state_value_ensure] TO [email_runtime];
DENY EXECUTE ON [contacts].[county_value_ensure] TO [email_runtime];
DENY EXECUTE ON [contacts].[city_value_ensure] TO [email_runtime];
DENY EXECUTE ON [contacts].[colony_value_ensure] TO [email_runtime];

-- Contact profile/lifecycle capability is opt-in; existing channel-only principals retain their surface.
IF DATABASE_PRINCIPAL_ID(N'contact_runtime') IS NULL CREATE ROLE [contact_runtime] AUTHORIZATION [dbo];
IF NOT EXISTS (SELECT 1 FROM sys.database_role_members WHERE role_principal_id=DATABASE_PRINCIPAL_ID(N'contact_channels_runtime')
    AND member_principal_id=DATABASE_PRINCIPAL_ID(N'contact_runtime'))
    ALTER ROLE [contact_channels_runtime] ADD MEMBER [contact_runtime];
GRANT EXECUTE ON [contacts].[contact_change] TO [contact_runtime];
GRANT EXECUTE ON [contacts].[contact_read] TO [contact_runtime];
DENY EXECUTE ON [contacts].[person_name_value_ensure] TO [email_runtime];
DENY EXECUTE ON [contacts].[contact_names_replace] TO [email_runtime];
DENY EXECUTE ON [contacts].[contact_history_snapshot] TO [email_runtime];
DENY EXECUTE ON [contacts].[contact_profile_prepare] TO [email_runtime];
DENY EXECUTE ON [contacts].[contact_profile_read_rows] TO [email_runtime];

-- Administrative provisioning is a separate, opt-in trusted-backend capability.
IF DATABASE_PRINCIPAL_ID(N'provisioning_runtime') IS NULL
BEGIN
    CREATE ROLE [provisioning_runtime] AUTHORIZATION [dbo];
END
IF NOT EXISTS (
    SELECT 1 FROM sys.database_role_members
    WHERE role_principal_id = DATABASE_PRINCIPAL_ID(N'contact_runtime')
        AND member_principal_id = DATABASE_PRINCIPAL_ID(N'provisioning_runtime')
)
BEGIN
    ALTER ROLE [contact_runtime] ADD MEMBER [provisioning_runtime];
END
GRANT EXECUTE ON [security].[user_provision] TO [provisioning_runtime];
