namespace Sistrategia.Data.SqlClient.Contacts;

/// <summary>Resolved by trusted host code, never bound from a contact request body.</summary>
public sealed record ContactActorContext(Guid Actor, Guid Tenant);
public interface IContactContextAccessor
{
    ValueTask<ContactActorContext> GetAsync(CancellationToken cancellationToken);
}

public enum ContactPermission { Create, Edit, Delete, Restore, ReadDetail, ReadHistory, ReadDirectory }

/// <summary>
/// Required, fail-closed host policy. Authorize actor/tenant/contact capabilities; there is no default allow policy.
/// It must not base write permission on an unlocked mutable profile snapshot. Database actor/tenant checks still apply.
/// </summary>
public interface IContactAuthorizer
{
    ValueTask<bool> IsAllowedAsync(ContactActorContext context, Guid contact, ContactPermission permission,
        CancellationToken cancellationToken);
}

public interface IContactService
{
    Task<ContactSaveResult> CreateAsync(ContactCreateRequest request, CancellationToken cancellationToken = default);
    Task<ContactSaveResult> SaveAsync(ContactSaveRequest request, CancellationToken cancellationToken = default);
    Task<ContactDetail> ReadCurrentAsync(Guid contact, CancellationToken cancellationToken = default);
    Task<ContactRevision> ReadRevisionAsync(Guid contact, int entityVersion, int? compareEntityVersion = null,
        CancellationToken cancellationToken = default);
    Task<ContactDirectoryDetail> ReadDirectoryAsync(Guid contact, CancellationToken cancellationToken = default);
}

public sealed record ContactCreateRequest(ContactProfileInput Profile, IReadOnlyList<ContactCommand>? Commands = null,
    Guid? PublicKey = null);
public sealed record ContactSaveRequest(Guid PublicKey, int ExpectedEntityVersion, IReadOnlyList<ContactCommand> Commands);

/// <summary>CommandIndex is zero-based in the supplied command list. Identity survives later edits/deletion.</summary>
public sealed record ContactCommandIdentity(int CommandIndex, string Family, int Ordinal);
/// <summary>Returned only after confirmed commit. AuditDbrowVersion is null for an entirely ineffective save.</summary>
public sealed record ContactSaveResult(Guid PublicKey, int EntityVersion, long? AuditDbrowVersion,
    IReadOnlyList<ContactCommandIdentity> ChildIdentities);

/// <summary>Current detail contains state only. Historical differences/actions require ReadHistory separately.</summary>
public sealed record ContactDetail(Guid PublicKey, int EntityVersion, long DbrowVersion, int EntityTypeId,
    ContactProfileState Profile, IReadOnlyList<ContactEmailState> Emails, IReadOnlyList<ContactPhoneState> Phones,
    IReadOnlyList<ContactWebLinkState> WebLinks, IReadOnlyList<ContactAddressState> Addresses);

// A separate projection prevents history, action payloads, hidden children and personal profile fields leaking
// through a filtered full-detail object. DisplayOrder retains saved relative order; it may have gaps after filtering.
public sealed record DirectoryEmail(int Ordinal, int DisplayOrder, string Email, string? Location);
public sealed record DirectoryPhone(int Ordinal, int DisplayOrder, string E164, string? Extension, string? Location);
public sealed record DirectoryWebLink(int Ordinal, int DisplayOrder, string Url, string? DisplayText, string? LinkType, string? Location);
public sealed record DirectoryAddress(int Ordinal, int DisplayOrder, AddressValue Address, string? Location);
public sealed record ContactDirectoryDetail(Guid PublicKey, int EntityVersion, int ContactTypeId, string DisplayName,
    IReadOnlyList<DirectoryEmail> Emails, IReadOnlyList<DirectoryPhone> Phones,
    IReadOnlyList<DirectoryWebLink> WebLinks, IReadOnlyList<DirectoryAddress> Addresses);

public enum ContactFailure { Validation, Forbidden, NotFound, Conflict, Dependency, HistoryUnavailable, Storage }
public sealed class ContactServiceException(ContactFailure failure, string message, Exception? innerException = null)
    : Exception(message, innerException)
{
    public ContactFailure Failure { get; } = failure;
}
