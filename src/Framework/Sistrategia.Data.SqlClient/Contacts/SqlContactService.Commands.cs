namespace Sistrategia.Data.SqlClient.Contacts;

public sealed partial class SqlContactService
{
    internal static async Task<(int Version, ContactCommandIdentity? Identity)> ApplyAsync(SqlAuditUnit unit,
        Guid contact, int expected, ContactCommand command, int index, CancellationToken cancellationToken) {
        switch (command) {
            case ReplaceContactProfile c:
                ArgumentNullException.ThrowIfNull(c.Profile);
                return ((await unit.UpdateContactAsync(contact, expected, c.Profile, cancellationToken)).EntityVersion, null);
            case DeleteContact:
                return ((await unit.DeleteContactAsync(contact, expected, cancellationToken)).EntityVersion, null);
            case RestoreContact:
                return ((await unit.RestoreContactAsync(contact, expected, cancellationToken)).EntityVersion, null);
            case InsertContactEmail c: {
                ArgumentNullException.ThrowIfNull(c.Value);
                var result = await unit.InsertEmailAsync(contact, expected, c.Value, c.Location, c.IsPublic, cancellationToken);
                return (result.EntityVersion, new(index, "email", result.Ordinal));
            }
            case ReplaceContactEmail c: {
                if (c.Ordinal < 1) throw Invalid("Child ordinal must be positive."); ArgumentNullException.ThrowIfNull(c.Value);
                var result = await unit.UpdateEmailAsync(contact, expected, c.Ordinal, c.Value, c.Location, c.IsPublic, cancellationToken);
                return (result.EntityVersion, new(index, "email", result.Ordinal));
            }
            case DeleteContactEmail c: {
                if (c.Ordinal < 1) throw Invalid("Child ordinal must be positive.");
                var result = await unit.DeleteEmailAsync(contact, expected, c.Ordinal, cancellationToken);
                return (result.EntityVersion, new(index, "email", result.Ordinal));
            }
            case RestoreContactEmail c: {
                if (c.Ordinal < 1) throw Invalid("Child ordinal must be positive."); ArgumentNullException.ThrowIfNull(c.Value);
                var result = await unit.RestoreEmailAsync(contact, expected, c.Ordinal, c.Value, c.Location, c.IsPublic, cancellationToken);
                return (result.EntityVersion, new(index, "email", result.Ordinal));
            }
            case MoveContactEmail c: {
                if (c.Ordinal < 1) throw Invalid("Child ordinal must be positive."); if (c.DisplayOrder < 1) throw Invalid("Display order must be positive.");
                var result = await unit.MoveEmailAsync(contact, expected, c.Ordinal, c.DisplayOrder, cancellationToken);
                return (result.EntityVersion, new(index, "email", result.Ordinal));
            }
            case InsertContactPhone c: {
                ArgumentNullException.ThrowIfNull(c.Value);
                var result = await unit.InsertPhoneAsync(contact, expected, c.Value, c.Location, c.Extension, c.IsPublic, cancellationToken);
                return (result.EntityVersion, new(index, "phone", result.Ordinal));
            }
            case ReplaceContactPhone c: {
                if (c.Ordinal < 1) throw Invalid("Child ordinal must be positive."); ArgumentNullException.ThrowIfNull(c.Value);
                var result = await unit.UpdatePhoneAsync(contact, expected, c.Ordinal, c.Value, c.Location, c.Extension, c.IsPublic, cancellationToken);
                return (result.EntityVersion, new(index, "phone", result.Ordinal));
            }
            case DeleteContactPhone c: {
                if (c.Ordinal < 1) throw Invalid("Child ordinal must be positive.");
                var result = await unit.DeletePhoneAsync(contact, expected, c.Ordinal, cancellationToken);
                return (result.EntityVersion, new(index, "phone", result.Ordinal));
            }
            case RestoreContactPhone c: {
                if (c.Ordinal < 1) throw Invalid("Child ordinal must be positive."); ArgumentNullException.ThrowIfNull(c.Value);
                var result = await unit.RestorePhoneAsync(contact, expected, c.Ordinal, c.Value, c.Location, c.Extension, c.IsPublic, cancellationToken);
                return (result.EntityVersion, new(index, "phone", result.Ordinal));
            }
            case MoveContactPhone c: {
                if (c.Ordinal < 1) throw Invalid("Child ordinal must be positive."); if (c.DisplayOrder < 1) throw Invalid("Display order must be positive.");
                var result = await unit.MovePhoneAsync(contact, expected, c.Ordinal, c.DisplayOrder, cancellationToken);
                return (result.EntityVersion, new(index, "phone", result.Ordinal));
            }
            case InsertContactWebLink c: {
                ArgumentNullException.ThrowIfNull(c.Value);
                var result = await unit.InsertWebLinkAsync(contact, expected, c.Value, c.Location, c.IsPublic, cancellationToken);
                return (result.EntityVersion, new(index, "web_link", result.Ordinal));
            }
            case ReplaceContactWebLink c: {
                if (c.Ordinal < 1) throw Invalid("Child ordinal must be positive."); ArgumentNullException.ThrowIfNull(c.Value);
                var result = await unit.UpdateWebLinkAsync(contact, expected, c.Ordinal, c.Value, c.Location, c.IsPublic, cancellationToken);
                return (result.EntityVersion, new(index, "web_link", result.Ordinal));
            }
            case DeleteContactWebLink c: {
                if (c.Ordinal < 1) throw Invalid("Child ordinal must be positive.");
                var result = await unit.DeleteWebLinkAsync(contact, expected, c.Ordinal, cancellationToken);
                return (result.EntityVersion, new(index, "web_link", result.Ordinal));
            }
            case RestoreContactWebLink c: {
                if (c.Ordinal < 1) throw Invalid("Child ordinal must be positive."); ArgumentNullException.ThrowIfNull(c.Value);
                var result = await unit.RestoreWebLinkAsync(contact, expected, c.Ordinal, c.Value, c.Location, c.IsPublic, cancellationToken);
                return (result.EntityVersion, new(index, "web_link", result.Ordinal));
            }
            case MoveContactWebLink c: {
                if (c.Ordinal < 1) throw Invalid("Child ordinal must be positive."); if (c.DisplayOrder < 1) throw Invalid("Display order must be positive.");
                var result = await unit.MoveWebLinkAsync(contact, expected, c.Ordinal, c.DisplayOrder, cancellationToken);
                return (result.EntityVersion, new(index, "web_link", result.Ordinal));
            }
            case InsertContactAddress c: {
                ArgumentNullException.ThrowIfNull(c.Value);
                var result = await unit.InsertAddressAsync(contact, expected, c.Value, c.Location, c.IsPublic, cancellationToken);
                return (result.EntityVersion, new(index, "address", result.Ordinal));
            }
            case ReplaceContactAddress c: {
                if (c.Ordinal < 1) throw Invalid("Child ordinal must be positive."); ArgumentNullException.ThrowIfNull(c.Value);
                var result = await unit.UpdateAddressAsync(contact, expected, c.Ordinal, c.Value, c.Location, c.IsPublic, cancellationToken);
                return (result.EntityVersion, new(index, "address", result.Ordinal));
            }
            case DeleteContactAddress c: {
                if (c.Ordinal < 1) throw Invalid("Child ordinal must be positive.");
                var result = await unit.DeleteAddressAsync(contact, expected, c.Ordinal, cancellationToken);
                return (result.EntityVersion, new(index, "address", result.Ordinal));
            }
            case RestoreContactAddress c: {
                if (c.Ordinal < 1) throw Invalid("Child ordinal must be positive."); ArgumentNullException.ThrowIfNull(c.Value);
                var result = await unit.RestoreAddressAsync(contact, expected, c.Ordinal, c.Value, c.Location, c.IsPublic, cancellationToken);
                return (result.EntityVersion, new(index, "address", result.Ordinal));
            }
            case MoveContactAddress c: {
                if (c.Ordinal < 1) throw Invalid("Child ordinal must be positive."); if (c.DisplayOrder < 1) throw Invalid("Display order must be positive.");
                var result = await unit.MoveAddressAsync(contact, expected, c.Ordinal, c.DisplayOrder, cancellationToken);
                return (result.EntityVersion, new(index, "address", result.Ordinal));
            }
            default: throw Invalid("Unsupported contact command.");
        }
    }
}
