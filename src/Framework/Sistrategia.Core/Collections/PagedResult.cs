// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Collections;

public class PagedResult<T> : IPagedResult<T>
{
    private readonly List<T> internalList = new();

    public IEnumerable<T> Items => internalList;

    public long? TotalCount { get; set; }
    public bool HasMoreResults { get; set; }

    public void Add(T item) {
        internalList.Add(item);
    }

    public void AddRange(IEnumerable<T> items) {
        internalList.AddRange(items);
    }

    public IEnumerator<T> GetEnumerator() => Items.GetEnumerator();

    System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() =>
        Items.GetEnumerator();
}
