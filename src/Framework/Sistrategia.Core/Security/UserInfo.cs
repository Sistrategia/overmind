// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Security;

public class UserInfo : IUserInfo //, IPublicKey, IDisplayName, IThumbnailable
{
    public string? PublicKey { get; set; }
    public virtual string? DisplayName { get; set; }
    public virtual string? ThumbnailUrl { get; set; }
    public string? LoginName { get; set; }
    public string? EmailAddress { get; set; }
    public string? PrimaryUserRole { get; set; }

    // Lockout property for enable/disable status (573-T001)
    public DateTimeOffset? LockoutEnd { get; set; }

    /// <summary>
    /// Timestamp of the user's last successful login (573-T002).
    /// </summary>
    public DateTime? LastLoginAt { get; set; }
}
