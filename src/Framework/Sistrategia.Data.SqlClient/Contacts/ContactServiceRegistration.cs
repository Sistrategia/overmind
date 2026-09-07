using Microsoft.Extensions.DependencyInjection;

namespace Sistrategia.Data.SqlClient.Contacts;

public static class ContactServiceRegistration
{
    /// <summary>Register the host's scoped IContactContextAccessor and IContactAuthorizer separately; neither has a fallback.</summary>
    public static IServiceCollection AddSqlContactService(this IServiceCollection services, string connectionString) {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);
        services.AddScoped<IContactService>(provider => new SqlContactService(connectionString,
            provider.GetRequiredService<IContactContextAccessor>(), provider.GetRequiredService<IContactAuthorizer>()));
        return services;
    }
}
