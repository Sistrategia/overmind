// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

using Sistrategia.Entities;

namespace Sistrategia;

public /*abstract*/ class Party : EntityBase, IParty
{
    public Party(PartyType partyType) {
        PartyType = partyType;
    }

    public PartyType PartyType { get; init; }

    public bool IsPerson => PartyType == PartyType.Person;
    public bool IsOrganization => PartyType == PartyType.Organization;
    public bool IsGroup => PartyType == PartyType.Group;

    public override string? ToString() => DisplayName;

    // public string? PublicKey { get; set; }
    // public virtual string? LogicalKey { get; set; }
    // public virtual string? DisplayName { get; set; }
    // public virtual string? ThumbnailUrl { get; set; }

    public string? EmailAddress { get; set; }
    public string? PhoneNumber { get; set; }

    public string? ContactListInfoCard1 { get; set; }
    public string? ContactListInfoCard2 { get; set; }

    // Status flags for opportunity seeking and recruiting
    public bool Recruiting { get; set; } // For organizations: actively hiring/recruiting

    ////public string? Company { get; set; }
    //public string? CompanyPublicKey { get; set; }
    public string? Division { get; set; }
    //public string? DivisionPublicKey { get; set; }    
}
