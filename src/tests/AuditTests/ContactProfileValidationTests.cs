using Microsoft.VisualStudio.TestTools.UnitTesting;
using Sistrategia.Data.SqlClient;

namespace Overmind.AuditTests;

[TestClass, TestCategory("Infrastructure")]
public sealed class ContactProfileValidationTests
{
    [TestMethod]
    public void ContactProfileExactFieldsAndCategoryValidation() {
        new ContactProfileInput(1,"José 😀",PersonFirstName:"José ",PersonLastName2:"",Summary:new string('s',4096)).Validate();
        new ContactProfileInput(2,"Organization",Recruiting:true).Validate();
        foreach (var profile in new[] { new ContactProfileInput(3,"Group"), new(1," "),
            new(1,"Name",PersonFirstName:new string('n',257)), new(1,"Name",DisplayName:""),
            new(1,"Name",PersonAlias:"\ud800"), new(2,"Organization",PersonFirstName:""),
            new(1,"Name",Recruiting:true), new(2,"Organization",OpenToWork:true),
            new(1,"Name",PersonGenderCode:"female"),new(1,"Name",Summary:new string('s',4097)) })
            Assert.ThrowsExactly<ArgumentException>(()=>profile.Validate());
    }
}
