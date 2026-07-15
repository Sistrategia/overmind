// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Contacts;

public class PhoneCollection : IEnumerable<Phone>
{
    #region Private Fields    
    private readonly IContact contact;
    private readonly List<Phone> entityList = new();
    #endregion

    internal PhoneCollection(IContact contact) {
        this.contact = contact;
    }

    public IContact Owner => contact;

    public Phone? this[string locationName] {
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

            var phone = entityList.Find(p => locationName.Equals(p.LocationName, StringComparison.OrdinalIgnoreCase));
            if (phone is null) {
                Add(value);
            } else {
                phone.PhoneNumber = value.PhoneNumber;
                phone.AreaCode = value.AreaCode;
                phone.LocationName = value.LocationName;
            }
        }
    }

    public Phone? this[int index] {
        get { return entityList[index]; }
        set {
            if (value is null)
                throw new ArgumentNullException(nameof(value));
            entityList[index] = value;
        }
    }

    public int Count => entityList.Count;

    public void Add(Phone phone) {
        if (phone is null)
            throw new ArgumentNullException(nameof(phone));

        entityList.Add(phone);
        phone.Ordinal = entityList.IndexOf(phone) + 1;
    }

    public Phone Add(string phoneNumber, string? locationName = null) {
        if (string.IsNullOrEmpty(phoneNumber))
            throw new ArgumentNullException(nameof(phoneNumber));

        var phone = new Phone {
            PhoneNumber = phoneNumber.Trim(),
            LocationName = locationName?.Trim()
        };
        Add(phone);
        return phone;
    }

    IEnumerator<Phone> IEnumerable<Phone>.GetEnumerator() {
        return entityList.GetEnumerator();
    }

    System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() {
        return entityList.GetEnumerator();
    }
}

