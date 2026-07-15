// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Contacts;

public class EmailCollection : IEnumerable<Email>
{
    #region Private Fields    
    private readonly IContact contact;
    private readonly List<Email> entityList = new();
    #endregion

    internal EmailCollection(IContact contact) {
        this.contact = contact;
    }

    public IContact Owner => contact;

    public Email? this[string locationName] {
        get {
            if (string.IsNullOrEmpty(locationName))
                throw new ArgumentNullException(nameof(locationName));
            return entityList.Find(e => locationName.Equals(e.LocationName, StringComparison.OrdinalIgnoreCase));
        }
        set {
            if (string.IsNullOrEmpty(locationName))
                throw new ArgumentNullException(nameof(locationName));
            if (value is null)
                throw new ArgumentNullException(nameof(value));

            var email = entityList.Find(e => locationName.Equals(e.LocationName, StringComparison.OrdinalIgnoreCase));
            if (email is null) {
                Add(value);
            } else {
                email.EmailAddress = value.EmailAddress;
                email.LocationName = value.LocationName;
            }
        }
    }

    public Email? this[int index] {
        get { return entityList[index]; }
        set {
            if (value is null)
                throw new ArgumentNullException(nameof(value));
            entityList[index] = value;
        }
    }

    public int Count => entityList.Count;

    public void Add(Email email) {
        if (email is null)
            throw new ArgumentNullException(nameof(email));

        entityList.Add(email);
        email.Ordinal = entityList.IndexOf(email) + 1;
    }

    public Email Add(string emailAddress, string? locationName = null) {
        if (string.IsNullOrEmpty(emailAddress))
            throw new ArgumentNullException(nameof(emailAddress));

        var email = new Email {
            EmailAddress = emailAddress.Trim(),
            LocationName = locationName?.Trim()
        };
        Add(email);
        return email;
    }

    public void AddRange(IEnumerable<Email> enumerable) {
        if (enumerable is null)
            throw new ArgumentNullException(nameof(enumerable));

        foreach (var email in enumerable) {
            Add(email);
        }
    }

    IEnumerator<Email> IEnumerable<Email>.GetEnumerator() {
        return entityList.GetEnumerator();
    }

    System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() {
        return entityList.GetEnumerator();
    }
}
