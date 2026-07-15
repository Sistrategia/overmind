// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Entities;

public interface IEntityIdentifier : IDisplayName // IPublicKey,
//   ILogicalKey, IDisplayName
// , ILockable, IValidatable
// , ISummarizable
// , IImageable, IThumbnailable
// , IPrivatelyOwnable, ISystemOwnable
// , IVersionable
{
    public string? Key { get; }
    public string? Name { get; }
    public string? Value { get; }
    public DateTime? FromDate { get; }
    public DateTime? ToDate { get; }
    public string? EntityPublicKey { get; }
    public string? EntityDisplayName { get; }
}
