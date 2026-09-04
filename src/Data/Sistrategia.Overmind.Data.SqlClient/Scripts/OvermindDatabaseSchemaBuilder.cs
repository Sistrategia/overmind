using Microsoft.Extensions.Logging;
using Sistrategia.Data;
using Sistrategia.Data.SqlClient;

namespace Sistrategia.Overmind.Data.SqlClient.Scripts;

internal class OvermindDatabaseSchemaBuilder : SqlDatabaseSchemaBuilder
{
    public OvermindDatabaseSchemaBuilder(string connectionString, ILogger<Database> logger)
        : base(connectionString, logger) {
    }

    public override string SchemaName => "overmind";
    public override string SchemaDescription => "Sistrategia.Overmind.Data.SqlClient";
    public override string Version => "6.0.6829.0";

    public override void CreateSchemaObjects() {
        // CreateSchemaObject("notifications");
        // CreateSchemaObject("messaging");
        CreateSchemaObject(SchemaName);
        // CreateSchemaObjectIfNotExists("legacy");
        // CreateSchemaObjectIfNotExists("reports");
    }

    public override void CreateSchemaTables() {
        // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.UserMessages.create_user_important_message_schema.sql");

    }

    public override void CreateSchemaViews() {
        // Messaging views (spec 14): unread count + conversation/last-message snippet.
        // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.Messaging.create_messaging_conversation_unread_view.sql");
        // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.Messaging.create_messaging_conversation_view.sql");
    }

    public override void CreateSchemaFunctions() {
        // notification_get_by_public_key first: notification_insert EXECs it.
        // SAMPLE: RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.Notifications.create_notification_get_by_public_key.sql");
    }

    public override void InsertMinimalData() {
        RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.insert_minimal_data.sql");
        // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.Locations.insert_countries.sql");
        // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.Locations.insert_states.sql");
        // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.Locations.insert_cities.sql");
        // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.insert_minimal_sample_data.sql");
        InsertSistrategiaData();
    }

    public void InsertSistrategiaData() {
        RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.Sistrategia.insert_ernesto_sample_data.sql");
        // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.Sistrategia.insert_sistrategia_organization.sql");
        // // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.Sistrategia.insert_jocelyn_data.sql");
        // // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.Sistrategia.insert_ciceromae.sql");
        // // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.Sistrategia.insert_alejandro_sedano.sql");
        // // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.Sistrategia.insert_jorge_isaac.sql");
        // // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.Sistrategia.insert_alan.sql");
        // // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.Sistrategia.insert_erick_jovan.sql");
        // // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.Sistrategia.insert_antonio_mendez.sql");
        // // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.Sistrategia.insert_josue_astudillo.sql");
        // // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.Sistrategia.insert_jared_juarez.sql");
        // // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.Sistrategia.insert_alberto.sql");
        // // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.Sistrategia.insert_alex_esquijarosa.sql");
        // // // RunLocalStoredCommands("Sistrategia.Overmind.Data.SqlClient.Scripts.SampleData.insert_sistrategia_users_and_contacts.sql");
    }


    /// <summary>
    /// Inserts sample data for a specific named dataset.
    /// </summary>
    /// <param name="namedSampleSet">
    /// The name of the sample set to insert. 
    /// </param>
    /// <exception cref="ArgumentException">Thrown when namedSampleSet is not recognized</exception>
    public void InsertSampleData(string namedSampleSet) {
        switch (namedSampleSet.ToLower()) {
            case "all":
                // InsertAlumniClass2026Data();
                break;
            default:
                throw new ArgumentException(
                    $"Unknown sample set: '{namedSampleSet}'. Valid values are: all",
                    nameof(namedSampleSet));
        }
    }

    public override void DropSchemaObjects() {
        DropSchemaObjectIfExists(SchemaName);
        DropSchemaObjectIfExists("notifications");
    }

    public override void DropSchemaTypes() {

    }

    public override void DropSchemaTables() {
        DropTableIfExists("dbo", "user_important_message");
        DropTableIfExists("notifications", "user_important_message");
        DropTableIfExists("notifications", "notification");
    }

    public override void DropSchemaViews() {

    }

    public override void DropSchemaFunctions() {
        DropProcedureIfExists("notifications", "notification_insert");
        DropProcedureIfExists("notifications", "notification_get_by_public_key");
        DropProcedureIfExists("notifications", "notification_view");
        DropProcedureIfExists("notifications", "notification_get_unread_count");
        DropProcedureIfExists("notifications", "notification_mark_read");
        DropProcedureIfExists("notifications", "notification_mark_all_read");
    }

    protected override void RunLocalStoredCommands(string resourceName) {
        SqlDatabase.RunLocalStoredCommands(
            System.Reflection.Assembly.GetExecutingAssembly(), resourceName);
    }
}
