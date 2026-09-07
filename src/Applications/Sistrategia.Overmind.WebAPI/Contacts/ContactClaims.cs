using System.Security.Claims;
using Sistrategia.Data.SqlClient.Contacts;

namespace Sistrategia.Overmind.WebAPI.Contacts;

public static class ContactClaims
{
    public const string Actor = "overmind_actor";
    public const string Tenant = "overmind_tenant";
    public const string Grant = "overmind_contact";
    public const string SchemaAdmin = "overmind_schema_admin";

    public static ContactActorContext? Resolve(ClaimsPrincipal principal) {
        if (principal.Identity?.IsAuthenticated != true) return null;
        var actors = principal.FindAll(Actor).ToArray();
        var tenants = principal.FindAll(Tenant).ToArray();
        if (actors.Length != 1 || tenants.Length != 1 ||
            !Guid.TryParseExact(actors[0].Value, "D", out var actor) || actor == Guid.Empty ||
            !Guid.TryParseExact(tenants[0].Value, "D", out var tenant) || tenant == Guid.Empty) return null;
        return new(actor, tenant);
    }

    public static string PermissionName(ContactPermission permission) => permission switch {
        ContactPermission.Create => "create", ContactPermission.Edit => "edit",
        ContactPermission.Delete => "delete", ContactPermission.Restore => "restore",
        ContactPermission.ReadDetail => "read_detail", ContactPermission.ReadHistory => "read_history",
        ContactPermission.ReadDirectory => "read_directory", _ => throw new ArgumentOutOfRangeException(nameof(permission))
    };
}

public sealed class HttpContactContext(IHttpContextAccessor accessor) : IContactContextAccessor
{
    public ValueTask<ContactActorContext> GetAsync(CancellationToken cancellationToken) {
        cancellationToken.ThrowIfCancellationRequested();
        var context = accessor.HttpContext is { } http ? ContactClaims.Resolve(http.User) : null;
        return ValueTask.FromResult(context ?? throw new ContactServiceException(ContactFailure.Forbidden,
            "A single authenticated actor and tenant are required."));
    }
}

/// <summary>Signed grants are permission:target, where target is '*' for this token's tenant or one contact GUID.</summary>
public sealed class JwtContactAuthorizer(IHttpContextAccessor accessor) : IContactAuthorizer
{
    public ValueTask<bool> IsAllowedAsync(ContactActorContext context, Guid contact, ContactPermission permission,
        CancellationToken cancellationToken) {
        cancellationToken.ThrowIfCancellationRequested();
        var principal = accessor.HttpContext?.User;
        if (principal is null || ContactClaims.Resolve(principal) != context) return ValueTask.FromResult(false);
        var name = ContactClaims.PermissionName(permission);
        var allowed = principal.FindAll(ContactClaims.Grant).Any(claim => {
            var parts = claim.Value.Split(':');
            return parts.Length == 2 && parts[0] == name && (parts[1] == "*" ||
                (Guid.TryParseExact(parts[1], "D", out var key) && key == contact));
        });
        return ValueTask.FromResult(allowed);
    }
}
