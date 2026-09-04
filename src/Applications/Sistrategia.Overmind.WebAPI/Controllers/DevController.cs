using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sistrategia.Data;
using Sistrategia.Overmind.WebAPI.Models;
// using Sistrategia.Overmind.Data.SqlClient.Migrations;
// using Sistrategia.Overmind.WebAPI.Services;
// using Sistrategia.Overmind.WebAPI.Utils;
// using Sistrategia.Security;

namespace Sistrategia.Overmind.WebAPI.Controllers;

[ApiController, Route("api/dev")]
// [Authorize(Roles = "Developer")]
[AllowAnonymous]
public class DevController : ControllerBase
{
    private IDatabaseManager DatabaseManager { get; }
    private readonly ILogger<DevController> dbLogger;

    public DevController(
        IDatabaseManager databaseManager,
        // IMigrationRunner migrationRunner,
        // IEmailNotificationService emailService, 
        ILogger<DevController> logger) {
        DatabaseManager = databaseManager;
        // MigrationRunner = migrationRunner;
        // EmailService = emailService;
        dbLogger = logger;
    }

    [HttpGet("")]
    public DevModel GetDevModel() {
        var model = new DevModel {
            DataSource = DatabaseManager.DataSource,
            InitialCatalog = DatabaseManager.InitialCatalog,
            DatabaseServerVersion = DatabaseManager.DatabaseServerVersion,
            DatabaseSchemaVersion = DatabaseManager.GetDatabaseSchemaVersion(),
            NetCoreVersion = Environment.Version.ToString()
        };
        return model;
    }

    [HttpPost("createdatabase")]
    public ActionResult CreateDatabase() {
        dbLogger.LogInformation("Creating a new database...");
        DatabaseManager.CreateDatabase();
        dbLogger.LogInformation("New database created.");
        return Created();
    }

    [HttpPost("createschema")]
    public ActionResult CreateSchema() {
        dbLogger.LogInformation("Creating the database schema...");
        DatabaseManager.CreateSchema();
        dbLogger.LogInformation("Database schema created.");
        return Created();
    }

    [HttpPost("dropschema")]
    public ActionResult DropSchema() {
        dbLogger.LogInformation("Dropping the database schema...");
        DatabaseManager.DropSchema();
        dbLogger.LogInformation("Database schema dropped.");
        return Ok();
    }
}