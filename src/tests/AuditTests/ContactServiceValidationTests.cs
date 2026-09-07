using Microsoft.VisualStudio.TestTools.UnitTesting;
using Sistrategia.Data.SqlClient;
using Sistrategia.Data.SqlClient.Contacts;

namespace Overmind.AuditTests;

[TestClass]
public sealed class ContactServiceValidationTests
{
    [TestMethod]
    public async Task ContactServiceRejectsMissingContextAndDeniedCommandsBeforeConnection() {
        var context = new ContactServiceCases.Context(new(ContactProfileCases.Actor, Guid.Empty));
        var policy = new ContactServiceCases.Policy();
        var service = new SqlContactService("Deliberately invalid connection string", context, policy);
        await ContactServiceCases.Failure(ContactFailure.Forbidden, () => service.CreateAsync(new(new(1, "Person"))));
        Assert.AreEqual(0, policy.Calls.Count);
        context = new(new(ContactProfileCases.Actor, ContactProfileCases.Tenant));
        policy.Allow = (_, _, permission) => permission == ContactPermission.Edit;
        service = new("Deliberately invalid connection string", context, policy);
        var key = Guid.NewGuid();
        await ContactServiceCases.Failure(ContactFailure.Forbidden, () => service.SaveAsync(new(key, 1,
            [new ReplaceContactProfile(new(1, "Person")), new DeleteContact()])));
        Assert.AreEqual(1, context.Calls);
        CollectionAssert.AreEqual(new[] { ContactPermission.Edit, ContactPermission.Delete }, policy.Calls.Select(x => x.Permission).ToArray());
        Assert.IsTrue(policy.Calls.All(x => x.Contact == key));
        await ContactServiceCases.Failure(ContactFailure.Validation, () => service.SaveAsync(new(key, 1, [])));
        await ContactServiceCases.Failure(ContactFailure.Validation, () => service.SaveAsync(new(key, 1, new ContactCommand[] { null! })));
        await ContactServiceCases.Failure(ContactFailure.Validation, () => service.CreateAsync(new(new(1, "Person"),
            Enumerable.Repeat<ContactCommand>(new DeleteContact(), 257).ToArray())));
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        await Assert.ThrowsAsync<OperationCanceledException>(() => service.ReadCurrentAsync(key, cancellation.Token));
        Assert.AreEqual(1, context.Calls);
    }
}
