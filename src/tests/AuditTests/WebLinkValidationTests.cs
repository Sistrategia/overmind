using Microsoft.VisualStudio.TestTools.UnitTesting;
using Sistrategia.Data.SqlClient;
using Sistrategia.Contacts;

namespace Overmind.AuditTests;

[TestClass, TestCategory("Infrastructure")]
public sealed class WebLinkValidationTests
{
    [TestMethod]
    public void ExactUrlValidationAndDomainIdentity() {
        foreach (var url in new[] { "HTTP://Example.test", "https://example.test/A?b=2&a=%2f#Z",
            "https://example.test/A?b=2&a=%2F#Z", "https://example.test:443/", "https://example.test/á/😀",
            "http://[::1]:8080/path", "https://例え.test/道", "https://example.test/?q=%20" }) {
            var input = new WebLinkInput(url);
            input.Validate();
            Assert.AreEqual(url, input.Url);
        }
        foreach (var url in new[] { "", "example.test", "//example.test", "mailto:a@example.test", "javascript:alert(1)",
            "data:text/html,test", "ftp://example.test", "https:///path", "https://u:p@example.test", "https://@example.test",
            " https://example.test", "https://example.test ", "https://example.test/\n", "https://example.test/a\\b",
            "https://example.test/%", "https://example.test/%gg", "https://example.test/\ud800", "https://[bad]" })
            Assert.ThrowsExactly<ArgumentException>(() => new WebLinkInput(url).Validate(), url);
        Assert.ThrowsExactly<ArgumentException>(() => new WebLinkInput("https://example.test", "Website").Validate());
        Assert.ThrowsExactly<ArgumentException>(() => new WebLinkInput("https://example.test", "", "").Validate());
        Assert.ThrowsExactly<ArgumentException>(() => new WebLinkInput("https://example.test", DisplayText: new string('x', 257)).Validate());
        var link = new WebLink { Ordinal = 9, DisplayOrder = 2, Url = "https://example.test/A", DisplayText = "Label ", IsPublic = true };
        link.AcceptChanges();
        link.DisplayOrder = 1;
        Assert.IsTrue(link.HasChanges());
        Assert.AreEqual(9, link.Ordinal);
        link.RejectChanges();
        Assert.AreEqual(2, link.DisplayOrder);
        link.IsPublic = false;
        Assert.IsTrue(link.HasChanges());
        link.RejectChanges();
        Assert.IsTrue(link.IsPublic);
        Assert.AreEqual("Label ", link.DisplayText);
    }
}
