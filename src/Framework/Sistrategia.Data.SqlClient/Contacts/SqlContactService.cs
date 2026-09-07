using Microsoft.Data.SqlClient;

namespace Sistrategia.Data.SqlClient.Contacts;

/// <summary>
/// One contact per Save, one owned audit unit, no automatic retry. Inject a trusted scoped context and policy.
/// Confirmed saves return identities/tokens without a second read that could observe a later writer.
/// AuditUnitCommitUncertainException and OperationCanceledException retain their distinct outcomes.
/// </summary>
public sealed partial class SqlContactService : IContactService
{
    private readonly string connectionString;
    private readonly IContactContextAccessor contextAccessor;
    private readonly IContactAuthorizer authorizer;

    public SqlContactService(string connectionString, IContactContextAccessor contextAccessor, IContactAuthorizer authorizer) {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);
        this.connectionString = connectionString;
        this.contextAccessor = contextAccessor ?? throw new ArgumentNullException(nameof(contextAccessor));
        this.authorizer = authorizer ?? throw new ArgumentNullException(nameof(authorizer));
    }

    public Task<ContactSaveResult> CreateAsync(ContactCreateRequest request, CancellationToken cancellationToken = default) =>
        ExecuteAsync(async () => {
            ArgumentNullException.ThrowIfNull(request);
            ArgumentNullException.ThrowIfNull(request.Profile);
            var contact = request.PublicKey ?? Guid.NewGuid();
            CheckKey(contact);
            var commands = Snapshot(request.Commands ?? [], allowEmpty: true);
            var context = await ContextAsync(cancellationToken);
            await RequireAsync(context, contact, ContactPermission.Create, cancellationToken);
            await AuthorizeCommandsAsync(context, contact, commands, cancellationToken);
            await using var unit = await SqlAuditUnit.BeginAsync(connectionString, context.Actor, context.Tenant, cancellationToken);
            var created = await unit.CreateContactAsync(request.Profile, contact, cancellationToken);
            return await CompleteAsync(unit, contact, 0, created.EntityVersion, commands, cancellationToken);
        }, cancellationToken);

    public Task<ContactSaveResult> SaveAsync(ContactSaveRequest request, CancellationToken cancellationToken = default) =>
        ExecuteAsync(async () => {
            ArgumentNullException.ThrowIfNull(request);
            CheckKey(request.PublicKey);
            if (request.ExpectedEntityVersion < 1) throw Invalid("An existing contact requires a positive expected revision.");
            var commands = Snapshot(request.Commands, allowEmpty: false);
            var context = await ContextAsync(cancellationToken);
            await AuthorizeCommandsAsync(context, request.PublicKey, commands, cancellationToken);
            await using var unit = await SqlAuditUnit.BeginAsync(connectionString, context.Actor, context.Tenant, cancellationToken);
            return await CompleteAsync(unit, request.PublicKey, request.ExpectedEntityVersion,
                request.ExpectedEntityVersion, commands, cancellationToken);
        }, cancellationToken);

    private static async Task<ContactSaveResult> CompleteAsync(SqlAuditUnit unit, Guid contact, int expected, int version,
        ContactCommand[] commands, CancellationToken cancellationToken) {
        var identities = new List<ContactCommandIdentity>();
        for (var index = 0; index < commands.Length; index++) {
            var applied = await ApplyAsync(unit, contact, expected, commands[index], index, cancellationToken);
            version = applied.Version;
            if (applied.Identity is not null) identities.Add(applied.Identity);
        }
        var result = new ContactSaveResult(contact, version, unit.DbrowVersion, identities.AsReadOnly());
        await unit.CommitAsync(cancellationToken);
        return result; // Do not check cancellation after confirmed commit or issue a fallible post-commit read.
    }

    public Task<ContactDetail> ReadCurrentAsync(Guid contact, CancellationToken cancellationToken = default) =>
        ExecuteAsync(async () => {
            CheckKey(contact);
            var context = await ContextAsync(cancellationToken);
            await RequireAsync(context, contact, ContactPermission.ReadDetail, cancellationToken);
            var revision = await new SqlContactReader(connectionString).ReadCurrentAsync(contact, context.Actor, context.Tenant, cancellationToken);
            return new ContactDetail(contact, revision.EntityVersion, revision.DbrowVersion,
                revision.Channels.EmailRevision.EntityTypeId, revision.Profile, revision.Channels.EmailRevision.Emails,
                revision.Channels.Phones, revision.Channels.WebLinks, revision.Channels.Addresses);
        }, cancellationToken);

    public Task<ContactRevision> ReadRevisionAsync(Guid contact, int entityVersion, int? compareEntityVersion = null,
        CancellationToken cancellationToken = default) => ExecuteAsync(async () => {
            CheckKey(contact);
            if (entityVersion < 1 || compareEntityVersion is < 1) throw Invalid("Historical revisions must be positive.");
            var context = await ContextAsync(cancellationToken);
            await RequireAsync(context, contact, ContactPermission.ReadDetail, cancellationToken);
            await RequireAsync(context, contact, ContactPermission.ReadHistory, cancellationToken);
            return await new SqlContactReader(connectionString).ReadAsync(contact, context.Actor, entityVersion,
                context.Tenant, compareEntityVersion, cancellationToken);
        }, cancellationToken);

    public Task<ContactDirectoryDetail> ReadDirectoryAsync(Guid contact, CancellationToken cancellationToken = default) =>
        ExecuteAsync(async () => {
            CheckKey(contact);
            var context = await ContextAsync(cancellationToken);
            await RequireAsync(context, contact, ContactPermission.ReadDirectory, cancellationToken);
            var revision = await new SqlContactReader(connectionString).ReadCurrentAsync(contact, context.Actor, context.Tenant, cancellationToken);
            if (revision.Profile.IsPrivate || revision.Profile.Deleted is not null)
                throw new ContactServiceException(ContactFailure.NotFound, "Contact is unavailable in the directory.");
            var channels = revision.Channels;
            return new ContactDirectoryDetail(contact, revision.EntityVersion, revision.Profile.ContactTypeId,
                revision.Profile.DisplayName ?? revision.Profile.FullName,
                channels.EmailRevision.Emails.Where(x => x.IsPublic).OrderBy(x => x.DisplayOrder)
                    .Select(x => new DirectoryEmail(x.Ordinal, x.DisplayOrder, x.Email, x.Location)).ToArray(),
                channels.Phones.Where(x => x.IsPublic).OrderBy(x => x.DisplayOrder)
                    .Select(x => new DirectoryPhone(x.Ordinal, x.DisplayOrder, x.Phone.E164, x.Extension, x.Location)).ToArray(),
                channels.WebLinks.Where(x => x.IsPublic).OrderBy(x => x.DisplayOrder)
                    .Select(x => new DirectoryWebLink(x.Ordinal, x.DisplayOrder, x.Url, x.DisplayText, x.LinkType, x.Location)).ToArray(),
                channels.Addresses.Where(x => x.IsPublic).OrderBy(x => x.DisplayOrder)
                    .Select(x => new DirectoryAddress(x.Ordinal, x.DisplayOrder, x.Address, x.Location)).ToArray());
        }, cancellationToken);

    private async Task<ContactActorContext> ContextAsync(CancellationToken cancellationToken) {
        cancellationToken.ThrowIfCancellationRequested();
        var context = await contextAccessor.GetAsync(cancellationToken);
        if (context is null || context.Actor == Guid.Empty || context.Tenant == Guid.Empty)
            throw new ContactServiceException(ContactFailure.Forbidden, "An authenticated actor and explicitly resolved tenant are required.");
        return context;
    }
    private async Task RequireAsync(ContactActorContext context, Guid contact, ContactPermission permission,
        CancellationToken cancellationToken) {
        cancellationToken.ThrowIfCancellationRequested();
        if (!await authorizer.IsAllowedAsync(context, contact, permission, cancellationToken))
            throw new ContactServiceException(ContactFailure.Forbidden, "Contact access is denied.");
    }
    private async Task AuthorizeCommandsAsync(ContactActorContext context, Guid contact, ContactCommand[] commands,
        CancellationToken cancellationToken) {
        foreach (var permission in commands.Select(c => c switch {
            DeleteContact => ContactPermission.Delete,
            RestoreContact => ContactPermission.Restore,
            _ => ContactPermission.Edit
        }).Distinct()) await RequireAsync(context, contact, permission, cancellationToken);
    }
    private static ContactCommand[] Snapshot(IReadOnlyList<ContactCommand> commands, bool allowEmpty) {
        ArgumentNullException.ThrowIfNull(commands);
        if (commands.Count > 256 || (!allowEmpty && commands.Count == 0))
            throw Invalid("Supply 1 to 256 commands for a save; initial creation may omit commands.");
        var snapshot = commands.ToArray();
        if (snapshot.Any(c => c is null)) throw Invalid("Commands cannot be null.");
        return snapshot;
    }
    private static void CheckKey(Guid contact) {
        if (contact == Guid.Empty) throw Invalid("Contact public key cannot be empty.");
    }
    private static ContactServiceException Invalid(string message) => new(ContactFailure.Validation, message);

    internal static async Task<T> ExecuteAsync<T>(Func<Task<T>> action, CancellationToken cancellationToken) {
        try { return await action(); }
        catch (ArgumentException error) { throw new ContactServiceException(ContactFailure.Validation, error.Message, error); }
        // SqlClient can report command attention as SqlException rather than OperationCanceledException.
        // Commit failures have already become AuditUnitCommitUncertainException and bypass this handler.
        catch (SqlException error) when (cancellationToken.IsCancellationRequested) {
            throw new OperationCanceledException("Contact operation was cancelled.", error, cancellationToken);
        }
        catch (SqlException error) {
            var failure = error.Number switch {
                51200 or 51201 or 229 => ContactFailure.Forbidden,
                51202 or 51401 or 51306 or 51706 or 51806 or 51906 => ContactFailure.NotFound,
                51601 or 51603 or 51203 or 51204 or 51206 or 52006 or 1205 or 2601 or 2627 or
                51307 or 51707 or 51807 or 51907 => ContactFailure.Conflict,
                52007 => ContactFailure.Dependency,
                51402 or 52010 or 51309 or 51709 or 51809 or 51909 => ContactFailure.HistoryUnavailable,
                51602 or 51605 or 51606 or 51607 or 51608 or 52000 or 52001 or 52004 or 52005 => ContactFailure.Validation,
                51300 or 51301 or 51305 or 51310 or 51700 or 51701 or 51705 or 51710 or 51717 or
                51800 or 51801 or 51805 or 51810 or 51817 or 51819 or
                51900 or 51901 or 51905 or 51910 or 51920 or 51921 or 51923 => ContactFailure.Validation,
                _ => ContactFailure.Storage
            };
            throw new ContactServiceException(failure, $"Contact operation failed: {failure}.", error);
        }
    }
}
