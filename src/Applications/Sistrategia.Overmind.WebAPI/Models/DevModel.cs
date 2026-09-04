namespace Sistrategia.Overmind.WebAPI.Models;

public class DevModel
{
    public string DataSource { get; set; } = string.Empty;
    public string InitialCatalog { get; set; } = string.Empty;
    public string NetCoreVersion { get; set; } = string.Empty;
    public string DatabaseServerVersion { get; set; } = string.Empty;
    public string DatabaseSchemaVersion { get; set; } = string.Empty;
    //public IEnumerable<Tenant> Tenants { get; set; } = new List<Tenant>();
}