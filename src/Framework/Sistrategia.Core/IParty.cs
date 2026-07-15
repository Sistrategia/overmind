// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

using Sistrategia.Entities;

namespace Sistrategia;

public interface IParty : IPublicKey, IDisplayName, ILogicalKey, IThumbnailable
{
    PartyType PartyType { get; }

    //bool IsPerson => PartyType == PartyType.Person;
    //bool IsOrganization => PartyType == PartyType.Organization;
    //bool IsGroup => PartyType == PartyType.Group;
    bool IsPerson { get; }
    bool IsOrganization { get; }
    bool IsGroup { get; }

    // IUserInfo
    //string? EmailAddress { get; set; }
    string? EmailAddress { get; }

    // IContactInfo
    //string? PhoneNumber { get; set; }
    string? PhoneNumber { get; }
    ////string? FormattedPhoneNumber { get; }
    //string? ContactListInfoCard1 { get; set; }
    //string? ContactListInfoCard2 { get; set; }

    string? ContactListInfoCard1 { get; }
    string? ContactListInfoCard2 { get; }

    //string? ContactListInfoCard1PublicKey { get; set; }    
    //string? ContactListInfoCard2PublicKey { get; set; }

    IEnumerable<IEntityIdentifier> Identifiers { get; }

    string? ToString() => DisplayName;

    string? Summary { get; }
}



// IContactInfo
//string? PhoneNumber { get; set; }
////string? FormattedPhoneNumber { get; }
//string? ContactListInfoCard1 { get; set; }
//string? ContactListInfoCard2 { get; set; }