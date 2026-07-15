// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

using Sistrategia.Entities;

namespace Sistrategia.Contacts;

public interface IContact : IParty, IImageable, ISummarizable
{
    EmailCollection Emails { get; }
    PhoneCollection Phones { get; }
    AddressCollection Addresses { get; }
    WebLinkCollection WebLinks { get; }

    string? PrimaryGroup { get; }
    string? PrimaryGroupPublicKey { get; }
}
