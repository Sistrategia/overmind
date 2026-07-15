// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

using Sistrategia.Security;

namespace Sistrategia;

public interface IVersionable
{
    DateTime Created { get; }

    DateTime Modified { get; }
    UserInfo ModifiedBy { get; }

    long? DBRowVersion { get; }
}