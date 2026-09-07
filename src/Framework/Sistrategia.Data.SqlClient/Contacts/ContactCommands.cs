namespace Sistrategia.Data.SqlClient.Contacts;

/// <summary>Closed command family. List order is execution/action order; omitted commands leave state unchanged.</summary>
public abstract record ContactCommand { private protected ContactCommand() { } }
public sealed record ReplaceContactProfile(ContactProfileInput Profile) : ContactCommand;
public sealed record DeleteContact : ContactCommand;
public sealed record RestoreContact : ContactCommand;
public sealed record InsertContactEmail(string Value, string? Location = null, bool IsPublic = false) : ContactCommand;
public sealed record ReplaceContactEmail(int Ordinal, string Value, string? Location = null, bool IsPublic = false) : ContactCommand;
public sealed record DeleteContactEmail(int Ordinal) : ContactCommand;
public sealed record RestoreContactEmail(int Ordinal, string Value, string? Location = null, bool IsPublic = false) : ContactCommand;
public sealed record MoveContactEmail(int Ordinal, int DisplayOrder) : ContactCommand;
public sealed record InsertContactPhone(PhoneInput Value, string? Location = null, string? Extension = null, bool IsPublic = false) : ContactCommand;
public sealed record ReplaceContactPhone(int Ordinal, PhoneInput Value, string? Location = null, string? Extension = null, bool IsPublic = false) : ContactCommand;
public sealed record DeleteContactPhone(int Ordinal) : ContactCommand;
public sealed record RestoreContactPhone(int Ordinal, PhoneInput Value, string? Location = null, string? Extension = null, bool IsPublic = false) : ContactCommand;
public sealed record MoveContactPhone(int Ordinal, int DisplayOrder) : ContactCommand;
public sealed record InsertContactWebLink(WebLinkInput Value, string? Location = null, bool IsPublic = false) : ContactCommand;
public sealed record ReplaceContactWebLink(int Ordinal, WebLinkInput Value, string? Location = null, bool IsPublic = false) : ContactCommand;
public sealed record DeleteContactWebLink(int Ordinal) : ContactCommand;
public sealed record RestoreContactWebLink(int Ordinal, WebLinkInput Value, string? Location = null, bool IsPublic = false) : ContactCommand;
public sealed record MoveContactWebLink(int Ordinal, int DisplayOrder) : ContactCommand;
public sealed record InsertContactAddress(AddressInput Value, string? Location = null, bool IsPublic = false) : ContactCommand;
public sealed record ReplaceContactAddress(int Ordinal, AddressInput Value, string? Location = null, bool IsPublic = false) : ContactCommand;
public sealed record DeleteContactAddress(int Ordinal) : ContactCommand;
public sealed record RestoreContactAddress(int Ordinal, AddressInput Value, string? Location = null, bool IsPublic = false) : ContactCommand;
public sealed record MoveContactAddress(int Ordinal, int DisplayOrder) : ContactCommand;
