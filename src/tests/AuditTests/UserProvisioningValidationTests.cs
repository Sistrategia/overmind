using System.Net;
using System.Text.Json;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Sistrategia.Data.SqlClient.Security;
using Sistrategia.Data.SqlClient;

namespace Overmind.AuditTests;

[TestClass]
public sealed class UserProvisioningValidationTests
{
    [TestMethod]
    public async Task UserProvisioningOpenApiAndSecretTransport() {
        await using var host = await ContactHttpHost.Start(environment: "Development");
        using var swagger = await host.Client.GetAsync("/swagger/v1/swagger.json");
        Assert.AreEqual(HttpStatusCode.OK, swagger.StatusCode);
        using var document = JsonDocument.Parse(await swagger.Content.ReadAsStringAsync());
        var schemas = document.RootElement.GetProperty("components").GetProperty("schemas");
        var password = schemas.GetProperty("UserAccountInput").GetProperty("properties").GetProperty("password");
        Assert.IsTrue(password.GetProperty("writeOnly").GetBoolean());
        Assert.AreEqual("password", password.GetProperty("format").GetString());
        Assert.AreEqual(21, schemas.GetProperty("CreateUserRequest").GetProperty("properties").GetProperty("commands")
            .GetProperty("items").GetProperty("oneOf").GetArrayLength());
        Assert.IsTrue(document.RootElement.GetProperty("paths").TryGetProperty("/api/users/{contact}/promote", out _));
        var account = new UserAccountInput("email@example.test", UserProvisioningCases.Password);
        Assert.IsFalse(account.ToString().Contains(UserProvisioningCases.Password));
        var request = new CreateUserRequest(new(1, "Person"), account);
        Assert.IsFalse(request.ToString().Contains(UserProvisioningCases.Password));
        await host.Send(HttpMethod.Post, "/api/users", HttpStatusCode.Unauthorized, "{}", host.Token(unsigned: true, provision: "*"));
        await host.Send(HttpMethod.Post, "/api/users", HttpStatusCode.BadRequest,
            "{\"account\":{\"loginName\":\"x\",\"password\":\"secret\",\"passwordSalt\":\"forged\"}}", host.Token(provision: "*"));
        var failing = new UncertainService();
        await using var uncertain = await ContactHttpHost.Start(provisioningService: failing);
        var response = await uncertain.Send(HttpMethod.Post, "/api/users", HttpStatusCode.InternalServerError,
            "{}", uncertain.Token(provision: "*"));
        Assert.AreEqual("commit_uncertain", response.Body.GetProperty("code").GetString());
        Assert.IsFalse(response.Body.GetProperty("automaticRetryAllowed").GetBoolean());
        Assert.IsFalse(response.Body.GetRawText().Contains("secret"));
        Assert.AreEqual(1, failing.Calls);
    }

    private sealed class UncertainService : IUserProvisioningService
    {
        internal int Calls;
        public Task<UserProvisioningResult> CreateAsync(CreateUserRequest request, CancellationToken cancellationToken = default) {
            Calls++;
            throw new AuditUnitCommitUncertainException(123, new InvalidOperationException("secret"));
        }
        public Task<UserProvisioningResult> PromoteAsync(PromoteUserRequest request, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }
}
