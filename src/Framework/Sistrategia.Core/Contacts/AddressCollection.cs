// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Contacts;

public class AddressCollection : IEnumerable<Address>
{
    #region Private Fields    
    private readonly IContact contact;
    private readonly List<Address> entityList = new();
    #endregion

    internal AddressCollection(IContact contact) {
        this.contact = contact;
    }

    public IContact Owner => contact;

    public Address? this[string locationName] {
        get {
            if (string.IsNullOrEmpty(locationName))
                throw new ArgumentNullException(nameof(locationName));
            return entityList.Find(p => locationName.Equals(p.LocationName, StringComparison.OrdinalIgnoreCase));
        }
        set {
            if (string.IsNullOrEmpty(locationName))
                throw new ArgumentNullException(nameof(locationName));
            if (value is null)
                throw new ArgumentNullException(nameof(value));

            var address = entityList.Find(p => locationName.Equals(p.LocationName, StringComparison.OrdinalIgnoreCase));
            if (address is null) {
                Add(value);
            } else {
                address.Address1 = value.Address1;
                address.Address2 = value.Address2;
                address.ZipCode = value.ZipCode;
                address.City = value.City;
                address.State = value.State;
                address.Country = value.Country;
                address.LocationName = value.LocationName;
            }
        }
    }

    public Address? this[int index] {
        get { return entityList[index]; }
        set {
            if (value is null)
                throw new ArgumentNullException(nameof(value));
            entityList[index] = value;
        }
    }

    public int Count => entityList.Count;

    public void Add(Address address) {
        if (address is null)
            throw new ArgumentNullException(nameof(address));

        entityList.Add(address);
        address.Ordinal = entityList.IndexOf(address) + 1;
    }

    IEnumerator<Address> IEnumerable<Address>.GetEnumerator() {
        return entityList.GetEnumerator();
    }

    System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() {
        return entityList.GetEnumerator();
    }
}
