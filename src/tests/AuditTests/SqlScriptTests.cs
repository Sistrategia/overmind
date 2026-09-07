using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Overmind.AuditTests;

[TestClass, TestCategory("Infrastructure")]
public sealed class SqlScriptTests
{
    [TestMethod]
    public void GoOnlySeparatesStandaloneUnquotedBatches() {
        var batches = SqlScript.Batches("""
            SELECT N'go', [GO], "GO"; -- GO
            GO -- actual delimiter
            SELECT N'escaped '' quote
            GO
            still in string';
            /* outer /* nested */
            GO
            */
            SELECT [escaped ]]
            GO
            identifier];
            SELECT "escaped ""
            GO
            identifier";
              go
            SELECT 3;
            """);
        Assert.HasCount(3, batches);
        StringAssert.Contains(batches[1], "still in string");
        StringAssert.Contains(batches[1], "/* outer");
        StringAssert.Contains(batches[1], "identifier];");
        StringAssert.Contains(batches[1], "identifier\";");
        Assert.AreEqual("SELECT 3;", batches[2].Trim());
    }

    [TestMethod]
    public void EmptyBatchesAreIgnoredAndUnsupportedDirectivesFail() {
        Assert.IsEmpty(SqlScript.Batches("GO\n  go -- empty\n"));
        foreach (var directive in new[] { "GO 2", ":r another.sql", ":setvar db prod", "!! command" })
            Assert.ThrowsExactly<FormatException>(() => SqlScript.Batches(directive));
    }
}
