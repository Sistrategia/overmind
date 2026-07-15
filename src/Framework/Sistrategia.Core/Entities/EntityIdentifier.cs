// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Entities;

public class EntityIdentifier : IEntityIdentifier //, ILogicalKey, IDisplayName
{
    // public string? LogicalKey { get; }
    public string? DisplayName => Value;

    public string? Key { get; set; }
    public string? Name { get; set; }
    public string? Value { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public string? EntityPublicKey { get; set; }
    public string? EntityDisplayName { get; set; }
}
