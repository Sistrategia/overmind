using System.Globalization;
using Sistrategia.Data.SqlClient.Contacts;
using Sistrategia.Data.SqlClient.Security;

namespace Sistrategia.Overmind.WebAPI.Contacts;

public sealed class JwtProvisioningAuthorizer(IHttpContextAccessor accessor) : IUserProvisioningAuthorizer
{
    public const string ProvisionClaim = "overmind_provision";
    public const string AssignRoleClaim = "overmind_assign_role";

    public ValueTask<bool> CanProvisionAsync(ContactActorContext context, Guid contact, CancellationToken cancellationToken) {
        cancellationToken.ThrowIfCancellationRequested();
        var principal = accessor.HttpContext?.User;
        return ValueTask.FromResult(principal is not null && ContactClaims.Resolve(principal) == context &&
            principal.FindAll(ProvisionClaim).Any(c => c.Value == "*" ||
                (Guid.TryParseExact(c.Value, "D", out var key) && key == contact)));
    }
    public ValueTask<bool> CanAssignRoleAsync(ContactActorContext context, int roleId, CancellationToken cancellationToken) {
        cancellationToken.ThrowIfCancellationRequested();
        var principal = accessor.HttpContext?.User;
        // No wildcard grant for role assignment: the issuer must name the exact local definition.
        return ValueTask.FromResult(principal is not null && ContactClaims.Resolve(principal) == context &&
            principal.FindAll(AssignRoleClaim).Any(c => c.Value == roleId.ToString(CultureInfo.InvariantCulture)));
    }
}
