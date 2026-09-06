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
DENY EXECUTE ON [security].[system_user_bootstrap] TO [email_runtime];
DENY EXECUTE ON [security].[user_history_create] TO [email_runtime];
-- Legacy constructors retain separate compatibility/authorization work; this profile does not expose them.
DENY EXECUTE ON [entities].[entity_insert] TO [email_runtime];
DENY EXECUTE ON [contacts].[contact_insert] TO [email_runtime];
DENY EXECUTE ON [security].[user_insert] TO [email_runtime];
