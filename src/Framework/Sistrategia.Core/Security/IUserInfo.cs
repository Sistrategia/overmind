// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Security;

public interface IUserInfo : IPublicKey, IDisplayName, IThumbnailable
{
    string? LoginName { get; }
    string? EmailAddress { get; }
    string? PrimaryUserRole { get; }
}
