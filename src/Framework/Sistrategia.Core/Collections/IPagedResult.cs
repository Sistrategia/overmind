// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Collections;

public interface IPagedResult<T> : IEnumerable<T>
{
    //int PageIndex { get; }
    //int PageSize { get; set; }
    //int Count { get; }
    IEnumerable<T> Items { get; }
    long? TotalCount { get; }
    bool HasMoreResults { get; }
}
