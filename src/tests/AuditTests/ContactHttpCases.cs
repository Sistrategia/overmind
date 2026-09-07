using System.Net;
using System.Text.Json;
using Sistrategia.Overmind.WebAPI.Contacts;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Overmind.AuditTests;

internal static class ContactHttpCases
{
    private static string Json(object value) => JsonSerializer.Serialize(value);
    internal static object[] Initial() => [
        new { kind = "email.insert", value = "private@example.test", isPublic = false },
        new { kind = "phone.insert", value = new { number = "+527773123456" }, isPublic = true },
        new { kind = "web_link.insert", value = new { url = "https://example.test/before" }, isPublic = true },
        new { kind = "address.insert", value = new { address1 = "Before" }, isPublic = true }];

    internal static async Task AtomicLifecycle(AuditDatabase db) {
        await using var host = await ContactHttpHost.Start(db.ConnectionString);
        var token = host.Token();
        foreach (var type in new[] { 1, 2 }) {
            var created = await host.Send(HttpMethod.Post, "/api/contacts", HttpStatusCode.Created,
                Json(new { profile = new { contactTypeId = type, fullName = "Before" }, commands = Initial() }), token);
            var key = created.Body.GetProperty("publicKey").GetGuid();
            var path = "/api/contacts/" + key;
            Assert.AreEqual(1, created.Body.GetProperty("entityVersion").GetInt32());
            Assert.AreEqual(JsonValueKind.String, created.Body.GetProperty("auditDbrowVersion").ValueKind);
            Assert.AreEqual(4, created.Body.GetProperty("childIdentities").GetArrayLength());
            var saved = await host.Send(HttpMethod.Post, path + "/save", HttpStatusCode.OK, Json(new {
                expectedEntityVersion = 1, commands = new object[] {
                    new { kind = "profile.replace", profile = new { contactTypeId = type, fullName = "After", summary = (string?)null } },
                    new { kind = "phone.replace", ordinal = 1, value = new { number = "+527773123456" }, extension = "After", isPublic = true },
                    new { kind = "address.replace", ordinal = 1, value = new { address1 = "After" }, isPublic = true }
                } }), token);
            Assert.AreEqual(2, saved.Body.GetProperty("entityVersion").GetInt32());
            var current = await host.Send(HttpMethod.Get, path, HttpStatusCode.OK, token: token);
            Assert.AreEqual("After", current.Body.GetProperty("profile").GetProperty("fullName").GetString());
            Assert.AreEqual("After", current.Body.GetProperty("phones")[0].GetProperty("extension").GetString());
            Assert.IsFalse(current.Body.TryGetProperty("actions", out _));
            var history = await host.Send(HttpMethod.Get, path + "/revisions/2?compareEntityVersion=1", HttpStatusCode.OK, token: token);
            Assert.AreEqual("Before", history.Body.GetProperty("profileDifferences")[0].GetProperty("oldProfile").GetProperty("fullName").GetString());
            CollectionAssert.AreEqual(new[] { "contact", "phone", "address" }, history.Body.GetProperty("actions").EnumerateArray().Select(x => x.GetProperty("family").GetString()).ToArray());
            var first = await host.Send(HttpMethod.Get, path + "/revisions/1", HttpStatusCode.OK, token: token);
            Assert.AreEqual("Before", first.Body.GetProperty("profile").GetProperty("fullName").GetString());
            await host.Send(HttpMethod.Post, path + "/save", HttpStatusCode.Conflict,
                Json(new { expectedEntityVersion = 1, commands = new[] { new { kind = "contact.delete" } } }), token);
            var failed = await host.Send(HttpMethod.Post, path + "/save", HttpStatusCode.BadRequest, Json(new {
                expectedEntityVersion = 2, commands = new object[] {
                    new { kind = "profile.replace", profile = new { contactTypeId = type, fullName = "Rollback" } },
                    new { kind = "email.replace", ordinal = 1, value = "rollback@example.test" },
                    new { kind = "address.replace", ordinal = 1, value = new { address1 = "Bad", countryId = int.MaxValue } }
                } }), token);
            Assert.AreEqual("validation", failed.Body.GetProperty("code").GetString());
            var unchanged = await host.Send(HttpMethod.Get, path, HttpStatusCode.OK, token: token);
            Assert.AreEqual(2, unchanged.Body.GetProperty("entityVersion").GetInt32());
            Assert.AreEqual("After", unchanged.Body.GetProperty("profile").GetProperty("fullName").GetString());
            Assert.AreEqual("private@example.test", unchanged.Body.GetProperty("emails")[0].GetProperty("email").GetString());
            await host.Send(HttpMethod.Post, path + "/save", HttpStatusCode.OK, Json(new { expectedEntityVersion = 2, commands = Initial() }), token);
            await host.Send(HttpMethod.Post, path + "/save", HttpStatusCode.OK, Json(new {
                expectedEntityVersion = 3, commands = new object[] {
                    new { kind = "email.move", ordinal = 2, displayOrder = 1 }, new { kind = "phone.move", ordinal = 2, displayOrder = 1 },
                    new { kind = "web_link.move", ordinal = 2, displayOrder = 1 }, new { kind = "address.move", ordinal = 2, displayOrder = 1 },
                    new { kind = "web_link.replace", ordinal = 1, value = new { url = "https://example.test/after" } }
                } }), token);
            await host.Send(HttpMethod.Post, path + "/save", HttpStatusCode.OK, Json(new {
                expectedEntityVersion = 4, commands = new[] { "email", "phone", "web_link", "address" }
                    .Select(family => new { kind = family + ".delete", ordinal = 1 }).ToArray()
                }), token);
            await host.Send(HttpMethod.Post, path + "/save", HttpStatusCode.OK, Json(new {
                expectedEntityVersion = 5, commands = new object[] {
                    new { kind = "email.restore", ordinal = 1, value = "restored@example.test" },
                    new { kind = "phone.restore", ordinal = 1, value = new { number = "+527773123456" } },
                    new { kind = "web_link.restore", ordinal = 1, value = new { url = "https://example.test/restored" } },
                    new { kind = "address.restore", ordinal = 1, value = new { address1 = "Restored" } }
                } }), token);
            var reordered = await host.Send(HttpMethod.Get, path, HttpStatusCode.OK, token: token);
            foreach (var family in new[] { "emails", "phones", "webLinks", "addresses" }) {
                Assert.AreEqual(2, reordered.Body.GetProperty(family)[0].GetProperty("ordinal").GetInt32());
                Assert.AreEqual(2, reordered.Body.GetProperty(family)[1].GetProperty("displayOrder").GetInt32());
            }
            await host.Send(HttpMethod.Post, path + "/save", HttpStatusCode.OK,
                Json(new { expectedEntityVersion = 6, commands = new[] { new { kind = "contact.delete" } } }), token);
            await host.Send(HttpMethod.Get, path + "/directory", HttpStatusCode.NotFound, token: token);
            await host.Send(HttpMethod.Post, path + "/save", HttpStatusCode.OK,
                Json(new { expectedEntityVersion = 7, commands = new[] { new { kind = "contact.restore" } } }), token);
            var final = await host.Send(HttpMethod.Get, path, HttpStatusCode.OK, token: token);
            Assert.AreEqual(8, final.Body.GetProperty("entityVersion").GetInt32());
            Assert.AreEqual(JsonValueKind.Null, final.Body.GetProperty("profile").GetProperty("deleted").ValueKind);
        }
    }

    internal static async Task AccessAndScope(AuditDatabase db) {
        await using var host = await ContactHttpHost.Start(db.ConnectionString);
        var full = host.Token();
        var created = await host.Send(HttpMethod.Post, "/api/contacts", HttpStatusCode.Created,
            Json(new { profile = new { contactTypeId = 1, fullName = "Scoped", summary = "PRIVATE_SUMMARY" }, commands = Initial() }), full);
        var key = created.Body.GetProperty("publicKey").GetGuid();
        var path = "/api/contacts/" + key;
        var directoryToken = host.Token(["read_directory:" + key]);
        var directory = await host.Send(HttpMethod.Get, path + "/directory", HttpStatusCode.OK, token: directoryToken);
        Assert.AreEqual(0, directory.Body.GetProperty("emails").GetArrayLength());
        Assert.AreEqual(1, directory.Body.GetProperty("phones").GetArrayLength());
        Assert.IsFalse(directory.Body.ToString().Contains("PRIVATE_SUMMARY", StringComparison.Ordinal));
        Assert.IsFalse(directory.Body.ToString().Contains("private@example.test", StringComparison.Ordinal));
        await host.Send(HttpMethod.Get, path, HttpStatusCode.Forbidden, token: directoryToken);
        await host.Send(HttpMethod.Get, path + "/revisions/1", HttpStatusCode.Forbidden, token: directoryToken);
        var detailToken = host.Token(["read_detail:" + key]);
        await host.Send(HttpMethod.Get, path, HttpStatusCode.OK, token: detailToken);
        await host.Send(HttpMethod.Get, path + "/revisions/1", HttpStatusCode.Forbidden, token: detailToken);
        await host.Send(HttpMethod.Get, "/api/contacts/" + Guid.NewGuid(), HttpStatusCode.Forbidden, token: detailToken);
        await host.Send(HttpMethod.Get, path, HttpStatusCode.OK, token: full, configure: request => {
            request.Headers.Add("X-Actor", Guid.NewGuid().ToString()); request.Headers.Add("X-Tenant", Guid.NewGuid().ToString());
        });
        await host.Send(HttpMethod.Get, path + "?tenant=" + Guid.NewGuid(), HttpStatusCode.BadRequest, token: full);
        await host.Send(HttpMethod.Post, path + "/save", HttpStatusCode.BadRequest,
            Json(new { expectedEntityVersion = 1, actor = Guid.NewGuid(), commands = new[] { new { kind = "contact.delete" } } }), full);
        await host.Send(HttpMethod.Post, path + "/save", HttpStatusCode.Forbidden, Json(new {
            expectedEntityVersion = 1, commands = new object[] {
                new { kind = "profile.replace", profile = new { contactTypeId = 1, fullName = "Rejected" } },
                new { kind = "contact.delete" }
            } }), host.Token(["edit:" + key]));
        var unchanged = await host.Send(HttpMethod.Get, path, HttpStatusCode.OK, token: full);
        Assert.AreEqual(1, unchanged.Body.GetProperty("entityVersion").GetInt32());
        await host.Send(HttpMethod.Post, path + "/save", HttpStatusCode.OK, Json(new {
            expectedEntityVersion = 1, commands = new[] { new { kind = "profile.replace", profile = new { contactTypeId = 1, fullName = "Private", isPrivate = true } } }
        }), full);
        await host.Send(HttpMethod.Get, path + "/directory", HttpStatusCode.NotFound, token: directoryToken);
        await host.Send(HttpMethod.Get, path, HttpStatusCode.Forbidden, token: host.Token(actor: Guid.NewGuid()));

        var otherTenant = Guid.Parse("908E5A8C-0372-4EDC-ADDF-011E059091EE");
        var otherActor = Guid.NewGuid();
        await db.ExecuteAsync($"""
            EXEC entities.entity_insert @entity_type_id=4,@public_key='{otherActor}',@tenant='{otherTenant}',
                @display_name=N'HTTP other actor',@created_by='{ContactProfileCases.Actor}';
            """);
        var otherToken = host.Token(actor: otherActor, tenant: otherTenant);
        var own = await host.Send(HttpMethod.Post, "/api/contacts", HttpStatusCode.Created,
            Json(new { profile = new { contactTypeId = 1, fullName = "Other tenant person" } }), otherToken);
        await host.Send(HttpMethod.Get, "/api/contacts/" + own.Body.GetProperty("publicKey").GetGuid(), HttpStatusCode.OK, token: otherToken);
        await host.Send(HttpMethod.Get, path, HttpStatusCode.NotFound, token: otherToken);
        await host.Send(HttpMethod.Post, path + "/save", HttpStatusCode.NotFound,
            Json(new { expectedEntityVersion = 2, commands = new[] { new { kind = "contact.delete" } } }), otherToken);
        await host.Send(HttpMethod.Get, path, HttpStatusCode.Forbidden, token: host.Token(tenant: otherTenant));
    }
}
