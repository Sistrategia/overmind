// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Contacts;

public interface IPerson : IParty
{
    string? FullName { get; set; }
    string? PersonTitle { get; set; }
    string? FirstName { get; set; }
    string? LastName { get; set; }
    string? LastName1 { get; set; }
    string? LastName2 { get; set; }
    string? Suffix { get; set; }

    string? Alias { get; set; }

    DateOnly? Birthdate { get; set; }
    string? GenderCode { get; set; }
    string? MaritalStatus { get; set; }

    string? JobTitle { get; set; }
    string? Company { get; set; }
    string? CompanyPublicKey { get; set; }
    string? Division { get; set; }
    string? DivisionPublicKey { get; set; }
}
