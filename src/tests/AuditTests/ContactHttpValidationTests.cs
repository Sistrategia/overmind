using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Sistrategia.Data.SqlClient;
using Sistrategia.Data.SqlClient.Contacts;
using Sistrategia.Overmind.WebAPI.Contacts;

namespace Overmind.AuditTests;

[TestClass]
public sealed class ContactHttpValidationTests
{
    [TestMethod]
    public async Task ContactHttpValidatesJwtAndRequiresExplicitClaims() {
        await using var host = await ContactHttpHost.Start();
        var path = "/api/contacts/" + Guid.NewGuid();
        var missing = await host.Send(HttpMethod.Get, path, HttpStatusCode.Unauthorized);
        Assert.AreEqual("Bearer", missing.Response.Headers.WwwAuthenticate.Single().Scheme);
        foreach (var token in new[] { "bad.token", host.Token(expired: true), host.Token(future: true),
            host.Token(issuer: "https://other.example.test"), host.Token(audience: "other"), host.Token(invalidSignature: true),
            host.Token(omitTenant: true), host.Token(duplicateActor: true), host.Token(duplicateTenant: true),
            host.Token(unsigned: true), host.Token(noExpiration: true), host.Token(actor: Guid.Empty) }) {
            var rejected = await host.Send(HttpMethod.Get, path, HttpStatusCode.Unauthorized, token: token);
            Assert.AreEqual("unauthenticated", rejected.Body.GetProperty("code").GetString());
            Assert.IsFalse(rejected.Body.ToString().Contains("IDX", StringComparison.Ordinal));
        }
        await host.Send(HttpMethod.Get, path, HttpStatusCode.Forbidden, token: host.Token([]));
        // Anonymous/destructive development routes no longer bypass the contact boundary.
        using var anonymousDev = await host.Client.PostAsync("/api/dev/dropschema", null);
        Assert.AreEqual(HttpStatusCode.Unauthorized, anonymousDev.StatusCode);
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/dev/dropschema");
        request.Headers.Authorization = new("Bearer", host.Token(schemaAdmin: true));
        using var outsideDevelopment = await host.Client.SendAsync(request);
        Assert.AreEqual(HttpStatusCode.Forbidden, outsideDevelopment.StatusCode);
        await using var development = await ContactHttpHost.Start(environment: "Development");
        using var disabled = new HttpRequestMessage(HttpMethod.Post, "/api/dev/dropschema");
        disabled.Headers.Authorization = new("Bearer", development.Token(schemaAdmin: true));
        using var disabledResult = await development.Client.SendAsync(disabled);
        Assert.AreEqual(HttpStatusCode.Forbidden, disabledResult.StatusCode);
        using var swagger = await development.Client.GetAsync("/swagger/v1/swagger.json");
        Assert.AreEqual(HttpStatusCode.OK, swagger.StatusCode, await swagger.Content.ReadAsStringAsync());
        using var openApi = JsonDocument.Parse(await swagger.Content.ReadAsStringAsync());
        var schemas = openApi.RootElement.GetProperty("components").GetProperty("schemas");
        Assert.AreEqual(23, schemas.GetProperty("ContactHttpSave").GetProperty("properties").GetProperty("commands")
            .GetProperty("items").GetProperty("oneOf").GetArrayLength());
        Assert.AreEqual("string", schemas.GetProperty("ContactSaveResult").GetProperty("properties").GetProperty("auditDbrowVersion").GetProperty("type").GetString());
        Assert.IsTrue(openApi.RootElement.GetProperty("paths").GetProperty("/api/contacts").GetProperty("post").TryGetProperty("requestBody", out _));
        var builder = WebApplication.CreateBuilder();
        builder.Configuration.Sources.Clear();
        Assert.ThrowsExactly<InvalidOperationException>(() => ContactApiHosting.ConfigureServices(builder));
    }

    [TestMethod]
    public async Task ContactHttpRejectsAmbiguousInputBeforeServiceAndPreservesBigintPrecision() {
        var fake = new ResultService();
        await using var host = await ContactHttpHost.Start(service: fake);
        var token = host.Token();
        foreach (var body in new[] {
            "null", "[]", "{", "{\"profile\":null,\"actor\":\"spoof\"}",
            "{\"profile\":null,\"tenant\":\"spoof\"}", "{\"profile\":null,\"profile\":null}",
            "{\"Profile\":null}", "{\"profile\":{\"contactTypeId\":1,\"fullName\":\"x\",\"actor\":\"spoof\"}}",
            "{\"commands\":[{\"kind\":\"unknown\"}]}",
            "{\"commands\":[{\"kind\":\"contact.delete\",\"kind\":\"contact.restore\"}]}",
            "{\"commands\":[{\"kind\":\"email.delete\",\"ordinal\":1,\"value\":\"ignored\"}]}",
            "{\"commands\":[{\"kind\":\"email.insert\",\"value\":\"x\",\"isPublic\":1}]}",
            "{\"commands\":[{\"kind\":\"phone.insert\",\"value\":{\"number\":\"x\",\"number\":\"y\"}}]}"
        }) await host.Send(HttpMethod.Post, "/api/contacts", HttpStatusCode.BadRequest, body, token);
        await host.Send(HttpMethod.Post, "/api/contacts", HttpStatusCode.RequestEntityTooLarge, new string(' ', ContactWireJson.MaximumBodyBytes + 1), token);
        await host.Send(HttpMethod.Post, "/api/contacts", HttpStatusCode.RequestEntityTooLarge, token: token,
            configure: request => request.Content = new UnboundedLengthContent());
        var media = await host.Send(HttpMethod.Post, "/api/contacts", HttpStatusCode.UnsupportedMediaType, "{}", token,
            configure: request => request.Content!.Headers.ContentType = new("text/plain"));
        Assert.AreEqual("json_required", media.Body.GetProperty("code").GetString());
        Assert.AreEqual(0, fake.Calls);
        var success = await host.Send(HttpMethod.Post, "/api/contacts", HttpStatusCode.Created,
            "{\"profile\":{\"contactTypeId\":1,\"fullName\":\"x\"}}", token);
        Assert.AreEqual(long.MaxValue.ToString(), success.Body.GetProperty("auditDbrowVersion").GetString());
        Assert.AreEqual("/api/contacts/" + fake.Key.ToString("D"), success.Response.Headers.Location!.ToString());
        Assert.AreEqual(1, fake.Calls);
    }

    [TestMethod]
    public async Task ContactHttpMapsServiceFailuresAndKeepsUncertainCommitDistinct() {
        var fake = new ResultService();
        await using var host = await ContactHttpHost.Start(service: fake);
        foreach (var (failure, status, code) in new[] {
            (ContactFailure.Validation, 400, "validation"), (ContactFailure.Forbidden, 403, "forbidden"),
            (ContactFailure.NotFound, 404, "not_found"), (ContactFailure.Conflict, 409, "conflict"),
            (ContactFailure.Dependency, 409, "dependency"), (ContactFailure.HistoryUnavailable, 409, "history_unavailable"),
            (ContactFailure.Storage, 500, "storage") }) {
            fake.Error = new ContactServiceException(failure, "SECRET SQL connection payload");
            var result = await host.Send(HttpMethod.Post, "/api/contacts", (HttpStatusCode)status, "{}", host.Token());
            Assert.AreEqual(code, result.Body.GetProperty("code").GetString());
            Assert.IsFalse(result.Body.ToString().Contains("SECRET", StringComparison.Ordinal));
            Assert.AreEqual("application/problem+json", result.Response.Content.Headers.ContentType!.MediaType);
        }
        fake.Error = new AuditUnitCommitUncertainException(long.MaxValue, new Exception("SECRET underlying error"));
        var before = fake.Calls;
        var uncertain = await host.Send(HttpMethod.Post, "/api/contacts", HttpStatusCode.InternalServerError, "{}", host.Token());
        Assert.AreEqual("commit_uncertain", uncertain.Body.GetProperty("code").GetString());
        Assert.IsFalse(uncertain.Body.GetProperty("automaticRetryAllowed").GetBoolean());
        Assert.IsFalse(uncertain.Body.ToString().Contains("SECRET", StringComparison.Ordinal));
        Assert.IsFalse(uncertain.Body.ToString().Contains(long.MaxValue.ToString(), StringComparison.Ordinal));
        Assert.AreEqual(before + 1, fake.Calls);
        fake.Error = new OperationCanceledException();
        var cancelled = await host.Send(HttpMethod.Post, "/api/contacts", HttpStatusCode.RequestTimeout, "{}", host.Token());
        Assert.AreEqual("cancelled", cancelled.Body.GetProperty("code").GetString());
    }

    private sealed class UnboundedLengthContent : HttpContent
    {
        public UnboundedLengthContent() { Headers.ContentType = new("application/json"); }
        protected override bool TryComputeLength(out long length) { length = 0; return false; }
        protected override async Task SerializeToStreamAsync(Stream stream, TransportContext? context) =>
            await stream.WriteAsync(new byte[ContactWireJson.MaximumBodyBytes + 1]);
    }

    private sealed class ResultService : IContactService
    {
        internal readonly Guid Key = Guid.NewGuid();
        internal int Calls;
        internal Exception? Error;
        public Task<ContactSaveResult> CreateAsync(ContactCreateRequest request, CancellationToken cancellationToken = default) {
            Calls++;
            return Error is null ? Task.FromResult(new ContactSaveResult(Key, 1, long.MaxValue, [])) : Task.FromException<ContactSaveResult>(Error);
        }
        public Task<ContactSaveResult> SaveAsync(ContactSaveRequest request, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<ContactDetail> ReadCurrentAsync(Guid contact, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<ContactRevision> ReadRevisionAsync(Guid contact, int entityVersion, int? compareEntityVersion = null, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<ContactDirectoryDetail> ReadDirectoryAsync(Guid contact, CancellationToken cancellationToken = default) => throw new NotImplementedException();
    }
}
