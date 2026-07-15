using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Sistrategia.Data.Extensions;

/// <summary>
/// Core extension methods for configuring Sistrategia Database services.
/// Provides provider-agnostic database service registration.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Configures the Sistrategia Database services using the specified connection string.
    /// This is the base method that provider-specific extensions can leverage.
    /// </summary>
    /// <param name="services">The service collection to configure</param>
    /// <param name="connectionString">The database connection string</param>
    /// <param name="configureOptions">Optional configuration action for advanced scenarios</param>
    /// <returns>The service collection for method chaining</returns>
    public static IServiceCollection AddSistrategiaDatabase(
        this IServiceCollection services,
        string connectionString,
        Action<DatabaseOptions>? configureOptions = null) {
        // Validate connection string early to provide clear error messages
        if (string.IsNullOrWhiteSpace(connectionString)) {
            throw new ArgumentException(
                "Database connection string cannot be null or empty. " +
                "Ensure the connection string is properly configured.",
                nameof(connectionString));
        }

        // Configure database options
        var options = new DatabaseOptions();
        configureOptions?.Invoke(options);

        // Register the connection string provider (provider-agnostic)
        services.AddSingleton<IConnectionStringProvider>(serviceProvider => {
            // Use a factory approach to allow provider-specific implementations
            return options.ConnectionStringProviderFactory?.Invoke(serviceProvider, connectionString)
                ?? throw new InvalidOperationException(
                    "No connection string provider factory configured. " +
                    "Use a provider-specific extension method (e.g., AddSistrategiaSqlDatabase).");
        });

        // Register the database manager based on configuration
        if (options.DatabaseManagerType != null) {
            services.AddTransient(typeof(IDatabaseManager), options.DatabaseManagerType);
        } else if (options.DatabaseManagerFactory != null) {
            services.AddTransient<IDatabaseManager>(options.DatabaseManagerFactory);
        } else {
            throw new InvalidOperationException(
                "No database manager configured. " +
                "Use a provider-specific extension method (e.g., AddSistrategiaSqlDatabase).");
        }

        // Register additional schema builders if specified
        foreach (var schemaBuilderType in options.SchemaBuilders) {
            services.AddTransient(typeof(IDatabaseSchemaBuilder), schemaBuilderType);
        }

        return services;
    }

    /// <summary>
    /// Configures the Sistrategia Database services using a connection string from configuration.
    /// This overload automatically retrieves the connection string from IConfiguration.
    /// </summary>
    /// <param name="services">The service collection to configure</param>
    /// <param name="configuration">The application configuration</param>
    /// <param name="connectionStringName">The name of the connection string (defaults to "DefaultConnection")</param>
    /// <param name="configureOptions">Optional configuration action for advanced scenarios</param>
    /// <returns>The service collection for method chaining</returns>
    public static IServiceCollection AddSistrategiaDatabase(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionStringName = "DefaultConnection",
        Action<DatabaseOptions>? configureOptions = null) {
        var connectionString = configuration.GetConnectionString(connectionStringName);

        if (string.IsNullOrWhiteSpace(connectionString)) {
            throw new InvalidOperationException(
                $"Connection string '{connectionStringName}' not found in configuration. " +
                "Please ensure the connection string is properly configured in appsettings.json.");
        }

        return services.AddSistrategiaDatabase(connectionString, configureOptions);
    }

    /// <summary>
    /// Configures the Sistrategia Database services with a specific IDatabaseManager implementation.
    /// This method provides type-safe registration of custom database managers.
    /// </summary>
    /// <typeparam name="TDatabaseManager">The concrete IDatabaseManager implementation to register</typeparam>
    /// <param name="services">The service collection to configure</param>
    /// <param name="connectionString">The database connection string</param>
    /// <param name="configureOptions">Optional configuration action for advanced scenarios</param>
    /// <returns>The service collection for method chaining</returns>
    public static IServiceCollection AddSistrategiaDatabase<TDatabaseManager>(
        this IServiceCollection services,
        string connectionString,
        Action<DatabaseOptions>? configureOptions = null)
        where TDatabaseManager : class, IDatabaseManager {
        return services.AddSistrategiaDatabase(connectionString, options => {
            options.DatabaseManagerType = typeof(TDatabaseManager);
            configureOptions?.Invoke(options);
        });
    }

    /// <summary>
    /// Configures the Sistrategia Database services with a specific IDatabaseManager implementation
    /// using connection string from configuration.
    /// </summary>
    /// <typeparam name="TDatabaseManager">The concrete IDatabaseManager implementation to register</typeparam>
    /// <param name="services">The service collection to configure</param>
    /// <param name="configuration">The application configuration</param>
    /// <param name="connectionStringName">The name of the connection string (defaults to "DefaultConnection")</param>
    /// <param name="configureOptions">Optional configuration action for advanced scenarios</param>
    /// <returns>The service collection for method chaining</returns>
    public static IServiceCollection AddSistrategiaDatabase<TDatabaseManager>(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionStringName = "DefaultConnection",
        Action<DatabaseOptions>? configureOptions = null)
        where TDatabaseManager : class, IDatabaseManager {
        return services.AddSistrategiaDatabase(configuration, connectionStringName, options => {
            options.DatabaseManagerType = typeof(TDatabaseManager);
            configureOptions?.Invoke(options);
        });
    }
}

/// <summary>
/// Configuration options for the Sistrategia Database services.
/// Allows customization of database manager type and additional schema builders.
/// </summary>
public class DatabaseOptions
{
    /// <summary>
    /// Gets or sets the type of IDatabaseManager implementation to register.
    /// If null, the factory method will be used.
    /// </summary>
    public Type? DatabaseManagerType { get; set; }

    /// <summary>
    /// Gets or sets a factory function for creating database manager instances.
    /// This provides more flexibility than type-based registration.
    /// </summary>
    public Func<IServiceProvider, IDatabaseManager>? DatabaseManagerFactory { get; set; }

    /// <summary>
    /// Gets or sets a factory function for creating connection string provider instances.
    /// This allows provider-specific implementations.
    /// </summary>
    public Func<IServiceProvider, string, IConnectionStringProvider>? ConnectionStringProviderFactory { get; set; }

    /// <summary>
    /// Gets the collection of additional schema builder types to register.
    /// These will be registered as IDatabaseSchemaBuilder implementations.
    /// </summary>
    public List<Type> SchemaBuilders { get; } = new();

    /// <summary>
    /// Adds a schema builder type to the configuration.
    /// </summary>
    /// <typeparam name="TSchemaBuilder">The schema builder type to add</typeparam>
    /// <returns>The options instance for method chaining</returns>
    public DatabaseOptions AddSchemaBuilder<TSchemaBuilder>()
        where TSchemaBuilder : class, IDatabaseSchemaBuilder {
        SchemaBuilders.Add(typeof(TSchemaBuilder));
        return this;
    }
}