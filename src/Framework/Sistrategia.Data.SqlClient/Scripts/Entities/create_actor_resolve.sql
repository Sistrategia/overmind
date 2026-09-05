-- Identity/scope validation only: the trusted application authenticates and authorizes its caller.
-- Ordinary writes currently support active user actors within their own tenant.
-- No implicit System, is_system, or cross-tenant bypass; platform delegation is a separate API.
CREATE OR ALTER PROCEDURE [entities].[actor_resolve]
    @actor UNIQUEIDENTIFIER, @tenant UNIQUEIDENTIFIER = NULL,
    @actor_entity_id INT OUTPUT, @tenant_id INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @actor_entity_id = NULL;
    SET @tenant_id = NULL;
    IF @tenant IS NULL SET @tenant = '908E5A8C-0372-4EDC-ADDF-011E059091ED';
    SET @tenant_id = (SELECT [tenant_id] FROM [data].[tenant] WHERE [public_key]=@tenant);
    IF @tenant_id IS NULL THROW 51200, 'Unknown target tenant.', 1;
    SELECT @actor_entity_id=e.[entity_id]
    FROM [entities].[entity] e JOIN [entities].[entity_type] t ON t.[entity_type_id]=e.[entity_type_id]
    WHERE e.[public_key]=@actor AND e.[tenant_id]=@tenant_id AND t.[code_name]=N'user'
      AND e.[deleted] IS NULL AND e.[locked] IS NULL;
    IF @actor_entity_id IS NULL THROW 51201, 'An active user actor authorized for this tenant is required.', 1;
END;
