using Microsoft.VisualStudio.TestTools.UnitTesting;
using Sistrategia.Data.SqlClient;
using Sistrategia.Contacts;

namespace Overmind.AuditTests;

[TestClass, TestCategory("Infrastructure")]
public sealed class AddressValidationTests
{
    [TestMethod]
    public void AddressRepresentationsAndExactDomainState() {
        foreach (var input in new[] { new AddressInput(Address1: "One", Address2: "", ZipCode: "AB 12"),
            new(StreetName: "Álamo 😀", ExtNumber: "12-B", IntNumber: ""), new(Country: "México"),
            new(ZipCode: "SW1A 1AA"), new(CityId: 12) }) {
            input.Validate();
            Assert.IsTrue(input.PrepareForDatabase().Contains("address1"));
        }
        foreach (var input in new[] { new AddressInput(), new(References: "Only a note"),
            new(Address1: "Line", StreetName: "Street"), new(ExtNumber: "1"),
            new(Address1: "One", CityId: 0), new(Country: " "), new(Address1: "\ud800"),
            new(Address1: new string('x', 257)), new(ZipCode: new string('z', 33)) })
            Assert.ThrowsExactly<ArgumentException>(() => input.Validate());
        var domain = new Address { Ordinal = 7, DisplayOrder = 2, Address1 = "Line ", ZipCode = "AB 12", CityId = 4, IsPublic = true };
        domain.AcceptChanges();
        domain.DisplayOrder = 1;
        domain.References = "Door";
        Assert.IsTrue(domain.HasChanges());
        Assert.AreEqual(7, domain.Ordinal);
        domain.RejectChanges();
        Assert.AreEqual(2, domain.DisplayOrder);
        Assert.IsNull(domain.References);
        Assert.AreEqual("AB 12", domain.ZipCode);
        Assert.AreEqual("Line ", domain.Address1);
        domain.IsPublic = false;
        Assert.IsTrue(domain.HasChanges());
    }
}
