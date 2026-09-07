using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Sistrategia.Data.SqlClient.Contacts;

namespace Sistrategia.Data.SqlClient.Security;

// Requests contain a password. Override record formatting so incidental diagnostics cannot print it.
public sealed record UserAccountInput(string LoginName, string Password, string? AccountEmail = null, int? InitialRoleId = null)
{
    public override string ToString() => "UserAccountInput { [redacted] }";
}
public sealed record CreateUserRequest(ContactProfileInput Profile, UserAccountInput Account,
    IReadOnlyList<ContactCommand>? Commands = null, Guid? PublicKey = null);
public sealed record PromoteUserRequest(Guid PublicKey, int ExpectedEntityVersion, UserAccountInput Account,
    IReadOnlyList<ContactCommand>? Commands = null);
public sealed record UserProvisioningResult(Guid PublicKey, int UserId, int EntityVersion, long? DbrowVersion,
    string LoginName, string? AccountEmail, int? InitialRoleId, IReadOnlyList<ContactCommandIdentity> ChildIdentities);

public interface IUserProvisioningAuthorizer
{
    ValueTask<bool> CanProvisionAsync(ContactActorContext context, Guid contact, CancellationToken cancellationToken);
    ValueTask<bool> CanAssignRoleAsync(ContactActorContext context, int roleId, CancellationToken cancellationToken);
}
public interface IUserProvisioningService
{
    Task<UserProvisioningResult> CreateAsync(CreateUserRequest request, CancellationToken cancellationToken = default);
    Task<UserProvisioningResult> PromoteAsync(PromoteUserRequest request, CancellationToken cancellationToken = default);
}

/// <summary>Identity V3 salted format; no trimming, case conversion or normalization of passwords.</summary>
public static class ProvisioningPassword
{
    public const int Iterations = 220_000;
    public static PasswordHasher<object> CreateHasher() => new(Options.Create(new PasswordHasherOptions {
        CompatibilityMode = PasswordHasherCompatibilityMode.IdentityV3, IterationCount = Iterations
    }));
    internal static string Hash(string password) {
        if (password is null || password.Length < 15 || password.Length > 128 || string.IsNullOrWhiteSpace(password))
            throw new ArgumentException("Password must contain 15 to 128 UTF-16 code units and cannot be all whitespace.");
        return CreateHasher().HashPassword(new object(), password);
    }
}

public sealed class SqlUserProvisioningService(string connectionString, IContactContextAccessor contextAccessor,
    IContactAuthorizer contactAuthorizer, IUserProvisioningAuthorizer authorizer) : IUserProvisioningService
{
    public Task<UserProvisioningResult> CreateAsync(CreateUserRequest request, CancellationToken cancellationToken = default) =>
        SqlContactService.ExecuteAsync(async () => {
            ArgumentNullException.ThrowIfNull(request);
            ArgumentNullException.ThrowIfNull(request.Profile);
            if (request.Profile.ContactTypeId != 1) throw new ArgumentException("Ordinary accounts require a person.");
            return await ProvisionAsync(request.PublicKey ?? Guid.NewGuid(), 0, request.Profile, request.Account,
                request.Commands, cancellationToken);
        }, cancellationToken);

    public Task<UserProvisioningResult> PromoteAsync(PromoteUserRequest request, CancellationToken cancellationToken = default) =>
        SqlContactService.ExecuteAsync(async () => {
            ArgumentNullException.ThrowIfNull(request);
            if (request.ExpectedEntityVersion < 1) throw new ArgumentException("Promotion requires a positive expected revision.");
            return await ProvisionAsync(request.PublicKey, request.ExpectedEntityVersion, null, request.Account,
                request.Commands, cancellationToken);
        }, cancellationToken);

    private async Task<UserProvisioningResult> ProvisionAsync(Guid contact, int expected, ContactProfileInput? profile,
        UserAccountInput account, IReadOnlyList<ContactCommand>? commands, CancellationToken cancellationToken) {
        if (contact == Guid.Empty) throw new ArgumentException("A nonempty contact key is required.");
        ArgumentNullException.ThrowIfNull(account);
        if (account.LoginName is null || account.LoginName.Length is < 1 or > 256 || account.LoginName.Any(InvalidLoginCharacter))
            throw new ArgumentException("Login requires 1 to 256 UTF-16 code units without whitespace or controls.");
        if (account.AccountEmail is not null && account.AccountEmail.Length is < 1 or > 256)
            throw new ArgumentException("Account email requires 1 to 256 UTF-16 code units.");
        if (account.InitialRoleId is < 1) throw new ArgumentException("Role ID must be positive.");
        if (commands?.Count > 256) throw new ArgumentException("At most 256 contact commands are allowed.");
        var snapshot = commands?.ToArray() ?? [];
        // Account construction has no implicit root restoration/deletion contract.
        if (snapshot.Any(c => c is null or DeleteContact or RestoreContact))
            throw new ArgumentException("Provisioning accepts profile/channel edits, not root lifecycle commands.");
        var context = await contextAccessor.GetAsync(cancellationToken);
        if (context is null || context.Actor == Guid.Empty || context.Tenant == Guid.Empty ||
            !await authorizer.CanProvisionAsync(context, contact, cancellationToken)) throw Forbidden();
        if (profile is not null && !await contactAuthorizer.IsAllowedAsync(context, contact, ContactPermission.Create, cancellationToken))
            throw Forbidden();
        if (snapshot.Length > 0 && !await contactAuthorizer.IsAllowedAsync(context, contact, ContactPermission.Edit, cancellationToken))
            throw Forbidden();
        if (account.InitialRoleId is { } role && !await authorizer.CanAssignRoleAsync(context, role, cancellationToken)) throw Forbidden();
        cancellationToken.ThrowIfCancellationRequested();
        var hash = ProvisioningPassword.Hash(account.Password);
        cancellationToken.ThrowIfCancellationRequested();
        await using var unit = await SqlAuditUnit.BeginAsync(connectionString, context.Actor, context.Tenant, cancellationToken);
        if (profile is not null) await unit.CreateContactAsync(profile, contact, cancellationToken);
        var identities = new List<ContactCommandIdentity>();
        for (var index = 0; index < snapshot.Length; index++) {
            var applied = await SqlContactService.ApplyAsync(unit, contact, expected, snapshot[index], index, cancellationToken);
            if (applied.Identity is not null) identities.Add(applied.Identity);
        }
        var result = await unit.ProvisionUserAsync(contact, expected, account.LoginName, hash,
            account.AccountEmail, account.InitialRoleId, cancellationToken);
        var receipt = new UserProvisioningResult(contact, result.UserId, result.EntityVersion, result.DbrowVersion,
            account.LoginName, account.AccountEmail, account.InitialRoleId, identities.AsReadOnly());
        await unit.CommitAsync(cancellationToken);
        return receipt;
    }
    private static bool InvalidLoginCharacter(char code) => code <= 32 || code is >= (char)127 and <= (char)160 ||
        code == 5760 || code is >= (char)8192 and <= (char)8203 || code is (char)8232 or (char)8233 or (char)8239 or (char)8287 or (char)12288 or (char)65279;
    private static ContactServiceException Forbidden() => new(ContactFailure.Forbidden, "Provisioning access is denied.");
}

public static class UserProvisioningRegistration
{
    public static IServiceCollection AddSqlUserProvisioning(this IServiceCollection services, string connectionString) {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);
        services.AddScoped<IUserProvisioningService>(p => new SqlUserProvisioningService(connectionString,
            p.GetRequiredService<IContactContextAccessor>(), p.GetRequiredService<IContactAuthorizer>(),
            p.GetRequiredService<IUserProvisioningAuthorizer>()));
        return services;
    }
}
