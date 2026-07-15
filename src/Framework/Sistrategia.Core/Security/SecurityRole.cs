
namespace Sistrategia.Security;

public class SecurityRole
{
    public string Name { get; set; } = string.Empty;
    // public string DisplayName { get; set; } = string.Empty;
    public string? Description { get; set; } = null; // string.Empty;
    public string? Tenant { get; set; } = null;
}
