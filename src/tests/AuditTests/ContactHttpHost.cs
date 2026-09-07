using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Sistrategia.Data.SqlClient.Contacts;
using Sistrategia.Overmind.WebAPI.Contacts;

namespace Overmind.AuditTests;

internal sealed class ContactHttpHost : IAsyncDisposable
{
    internal const string Issuer = "https://issuer.example.test";
    internal const string Audience = "overmind-contact-tests";
    internal const string UnusedConnection = "Server=unused.example.invalid;Database=master;Integrated Security=True;Encrypt=True";
    private readonly RSA rsa = RSA.Create(2048);
    private WebApplication app = null!;
    internal HttpClient Client { get; private set; } = null!;
    internal static async Task<ContactHttpHost> Start(string connectionString = UnusedConnection,
        IContactService? service = null, string environment = "Testing", bool schemaEnabled = false) {
        var host = new ContactHttpHost();
        try {
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions {
                EnvironmentName = environment, ApplicationName = typeof(ContactApiHosting).Assembly.GetName().Name,
                ContentRootPath = AppContext.BaseDirectory
            });
            builder.Logging.ClearProviders();
            builder.WebHost.UseTestServer();
            builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?> {
                ["ConnectionStrings:DefaultConnection"] = connectionString,
                ["ContactAuthentication:Authority"] = Issuer,
                ["ContactAuthentication:Issuer"] = Issuer,
                ["ContactAuthentication:Audience"] = Audience,
                ["Development:EnableSchemaEndpoints"] = schemaEnabled.ToString()
            });
            ContactApiHosting.ConfigureServices(builder);
            // Replace only metadata transport. The real bearer handler validates signature/issuer/audience/lifetime/claims.
            var configuration = new OpenIdConnectConfiguration { Issuer = Issuer };
            configuration.SigningKeys.Add(new RsaSecurityKey(host.rsa.ExportParameters(false)) { KeyId = "contact-test" });
            builder.Services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
                options.ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(configuration));
            if (service is not null) builder.Services.AddScoped<IContactService>(_ => service);
            host.app = builder.Build();
            ContactApiHosting.ConfigurePipeline(host.app);
            await host.app.StartAsync();
            host.Client = host.app.GetTestClient();
            host.Client.BaseAddress = new Uri("https://localhost");
            return host;
        } catch { await host.DisposeAsync(); throw; }
    }
    internal string Token(IEnumerable<string>? grants = null, Guid? actor = null, Guid? tenant = null,
        string? issuer = null, string? audience = null, bool invalidSignature = false, bool expired = false,
        bool omitTenant = false, bool duplicateActor = false, bool noExpiration = false, bool future = false,
        bool schemaAdmin = false, bool unsigned = false, bool duplicateTenant = false) {
        var claims = new List<Claim> { new(ContactClaims.Actor, (actor ?? ContactProfileCases.Actor).ToString("D")) };
        if (!omitTenant) claims.Add(new(ContactClaims.Tenant, (tenant ?? ContactProfileCases.Tenant).ToString("D")));
        if (duplicateActor) claims.Add(new(ContactClaims.Actor, Guid.NewGuid().ToString("D")));
        if (duplicateTenant) claims.Add(new(ContactClaims.Tenant, Guid.NewGuid().ToString("D")));
        claims.AddRange((grants ?? Enum.GetValues<ContactPermission>().Select(p => ContactClaims.PermissionName(p) + ":*"))
            .Select(value => new Claim(ContactClaims.Grant, value)));
        if (schemaAdmin) claims.Add(new(ContactClaims.SchemaAdmin, "true"));
        using var other = invalidSignature ? RSA.Create(2048) : null;
        var key = new RsaSecurityKey(other ?? rsa) { KeyId = "contact-test" };
        var jwt = new JwtSecurityToken(issuer ?? Issuer, audience ?? Audience, claims,
            notBefore: DateTime.UtcNow.AddMinutes(future ? 10 : -30),
            expires: noExpiration ? null : DateTime.UtcNow.AddMinutes(expired ? -5 : 30),
            signingCredentials: unsigned ? null : new SigningCredentials(key, SecurityAlgorithms.RsaSha256));
        return new JwtSecurityTokenHandler().WriteToken(jwt);
    }
    internal async Task<(HttpResponseMessage Response, JsonElement Body)> Send(HttpMethod method, string path,
        HttpStatusCode expected, string? json = null, string? token = null, Action<HttpRequestMessage>? configure = null) {
        using var request = new HttpRequestMessage(method, path);
        if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (json is not null) request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        configure?.Invoke(request);
        var response = await Client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        Assert.AreEqual(expected, response.StatusCode, text);
        Assert.AreEqual("no-store", response.Headers.CacheControl?.ToString(), path);
        using var document = JsonDocument.Parse(text);
        return (response, document.RootElement.Clone());
    }
    public async ValueTask DisposeAsync() {
        Client?.Dispose();
        if (app is not null) { await app.StopAsync(); await app.DisposeAsync(); }
        rsa.Dispose();
    }
}
