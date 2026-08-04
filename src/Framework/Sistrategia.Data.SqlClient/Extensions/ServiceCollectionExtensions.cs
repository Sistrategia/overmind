using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Sistrategia.Data;
using Sistrategia.Data.Extensions; // Import the core extensions
using Sistrategia.Data.SqlClient;

namespace Sistrategia.Data.SqlClient.Extensions;

/// <summary>
/// SQL Server-specific extension methods for configuring Sistrategia Database services.
/// Builds upon the core database extensions with SQL Server implementations.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Configures the Sistrategia Database services for SQL Server using the specified connection string.
    /// This method registers SQL Server-specific implementations for database operations.
    /// </summary>
    /// <param name="services">The service collection to configure</param>
    /// <param name="connectionString">The SQL Server connection string</param>
    /// <param name="configureOptions">Optional configuration action for advanced scenarios</param>
    /// <returns>The service collection for method chaining</returns>
    public static IServiceCollection AddSistrategiaSqlDatabase(
        this IServiceCollection services,
        string connectionString,
        Action<DatabaseOptions>? configureOptions = null) {
        return services.AddSistrategiaDatabase(connectionString, options => {
            // Configure SQL Server-specific implementations
            ConfigureSqlServerDefaults(options);

            // Allow additional configuration
            configureOptions?.Invoke(options);
        });
    }

    /// <summary>
    /// Configures the Sistrategia Database services for SQL Server using a connection string from configuration.
    /// </summary>
    /// <param name="services">The service collection to configure</param>
    /// <param name="configuration">The application configuration</param>
    /// <param name="connectionStringName">The name of the connection string (defaults to "DefaultConnection")</param>
    /// <param name="configureOptions">Optional configuration action for advanced scenarios</param>
    /// <returns>The service collection for method chaining</returns>
    public static IServiceCollection AddSistrategiaSqlDatabase(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionStringName = "DefaultConnection",
        Action<DatabaseOptions>? configureOptions = null) {
        return services.AddSistrategiaDatabase(configuration, connectionStringName, options => {
            // Configure SQL Server-specific implementations
            ConfigureSqlServerDefaults(options);

            // Allow additional configuration
            configureOptions?.Invoke(options);
        });
    }

    /// <summary>
    /// Configures the Sistrategia Database services for SQL Server with a specific IDatabaseManager implementation.
    /// </summary>
    /// <typeparam name="TDatabaseManager">The concrete IDatabaseManager implementation to register</typeparam>
    /// <param name="services">The service collection to configure</param>
    /// <param name="connectionString">The SQL Server connection string</param>
    /// <param name="configureOptions">Optional configuration action for advanced scenarios</param>
    /// <returns>The service collection for method chaining</returns>
    public static IServiceCollection AddSistrategiaSqlDatabase<TDatabaseManager>(
        this IServiceCollection services,
        string connectionString,
        Action<DatabaseOptions>? configureOptions = null)
        where TDatabaseManager : class, IDatabaseManager {
        return services.AddSistrategiaSqlDatabase(connectionString, options => {
            options.DatabaseManagerType = typeof(TDatabaseManager);
            configureOptions?.Invoke(options);
        });
    }

    /// <summary>
    /// Configures the Sistrategia Database services for SQL Server with a specific IDatabaseManager implementation
    /// using connection string from configuration.
    /// </summary>
    /// <typeparam name="TDatabaseManager">The concrete IDatabaseManager implementation to register</typeparam>
    /// <param name="services">The service collection to configure</param>
    /// <param name="configuration">The application configuration</param>
    /// <param name="connectionStringName">The name of the connection string (defaults to "DefaultConnection")</param>
    /// <param name="configureOptions">Optional configuration action for advanced scenarios</param>
    /// <returns>The service collection for method chaining</returns>
    public static IServiceCollection AddSistrategiaSqlDatabase<TDatabaseManager>(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionStringName = "DefaultConnection",
        Action<DatabaseOptions>? configureOptions = null)
        where TDatabaseManager : class, IDatabaseManager {
        return services.AddSistrategiaSqlDatabase(configuration, connectionStringName, options => {
            options.DatabaseManagerType = typeof(TDatabaseManager);
            configureOptions?.Invoke(options);
        });
    }

    /// <summary>
    /// Configures SQL Server-specific default implementations.
    /// This method encapsulates the SQL Server provider logic.
    /// </summary>
    /// <param name="options">The database options to configure</param>
    private static void ConfigureSqlServerDefaults(DatabaseOptions options) {
        // Configure SQL Server connection string provider factory
        options.ConnectionStringProviderFactory = (serviceProvider, connectionString) => {
            // var logger = serviceProvider.GetRequiredService<ILogger<SqlConnectionStringProvider>>();
            // return new SqlConnectionStringProvider(connectionString, logger);            
            return new SqlConnectionStringProvider(connectionString);
        };

        // Configure default SQL Server database manager if none specified
        if (options.DatabaseManagerType == null && options.DatabaseManagerFactory == null) {
            options.DatabaseManagerFactory = serviceProvider => {
                var connectionStringProvider = serviceProvider.GetRequiredService<IConnectionStringProvider>();
                var logger = serviceProvider.GetRequiredService<ILogger<Database>>();
                return new SqlDatabaseManager(connectionStringProvider, logger);
            };
        }

        // Register SQL Server-specific services
        // Note: This runs after the core registration, so we can add SQL-specific services here
    }

    /// <summary>
    /// Additional method to register SQL Connection for direct injection scenarios.
    /// This is useful when you need direct access to SqlConnection in your services.
    /// </summary>
    /// <param name="services">The service collection to configure</param>
    /// <param name="connectionString">The SQL Server connection string</param>
    /// <returns>The service collection for method chaining</returns>
    public static IServiceCollection AddSqlConnection(
        this IServiceCollection services,
        string connectionString) {
        services.AddTransient<SqlConnection>(_ => new SqlConnection(connectionString));
        return services;
    }

    /// <summary>
    /// Configures SQL Connection using connection string from configuration.
    /// </summary>
    /// <param name="services">The service collection to configure</param>
    /// <param name="configuration">The application configuration</param>
    /// <param name="connectionStringName">The name of the connection string (defaults to "DefaultConnection")</param>
    /// <returns>The service collection for method chaining</returns>
    public static IServiceCollection AddSqlConnection(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionStringName = "DefaultConnection") {
        var connectionString = configuration.GetConnectionString(connectionStringName);

        if (string.IsNullOrWhiteSpace(connectionString)) {
            throw new InvalidOperationException(
                $"Connection string '{connectionStringName}' not found in configuration.");
        }

        return services.AddSqlConnection(connectionString);
    }
}