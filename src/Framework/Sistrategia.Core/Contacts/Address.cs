// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

using System.Text;

namespace Sistrategia.Contacts;

public class Address
{
    #region Private Members

    private readonly AddressData currentData;
    private readonly AddressData originalData;

    #endregion

    #region Constructors

    public Address() {
        currentData = new AddressData();
        originalData = new AddressData();
        // AcceptChanges();
    }

    #endregion

    private AddressData CurrentData => currentData;
    private AddressData OriginalData => originalData;

    public string? ContactPublicKey {
        get { return CurrentData.ContactPublicKey?.ToString("N"); }
        set {
            CurrentData.ContactPublicKey = string.IsNullOrEmpty(value) ?
                null : (Guid?)Guid.Parse(value);
        }
    }

    public int? Ordinal {
        get { return CurrentData.Ordinal; }
        set { CurrentData.Ordinal = value; }
    }

    public string? DisplayName {
        get {
            return $"{Address1}, {Address2}, {ZipCode}, {City}, {State}, {Country}";
        }
    }

    public string? LocationName {
        get { return CurrentData.LocationName; }
        set { CurrentData.LocationName = value; }
    }

    public string? Address1 {
        get { return CurrentData.Address1; }
        set { CurrentData.Address1 = value; }
    }

    public string? Address2 {
        get { return CurrentData.Address2; }
        set { CurrentData.Address2 = value; }
    }

    public string? ZipCode {
        get { return CurrentData.ZipCode; }
        set { CurrentData.ZipCode = ReplaceWhitespace(value, ""); }
    }

    public string? City {
        get { return CurrentData.City; }
        set { CurrentData.City = value; }
    }

    public string? State {
        get { return CurrentData.State; }
        set { CurrentData.State = value; }
    }

    public string? Country {
        get { return CurrentData.Country; }
        set { CurrentData.Country = value; }
    }

    private static readonly System.Text.RegularExpressions.Regex sWhitespace = new System.Text.RegularExpressions.Regex(@"\s+");
    public static string? ReplaceWhitespace(string? input, string replacement) {
        if (input is null)
            return input;
        return sWhitespace.Replace(input, replacement);
    }

    protected static string? NormalizeWhiteSpace(string? denormalizedString) {
        if (denormalizedString is null)
            return denormalizedString;

        // if (string.IsNullOrEmpty(denormalizedString))
        //     return denormalizedString;

        string s = denormalizedString.Trim();
        bool iswhite = false;
        //int iwhite;
        int sLength = s.Length;
        StringBuilder sb = new(sLength);
        foreach (char c in s.ToCharArray()) {
            if (Char.IsWhiteSpace(c)) {
                if (iswhite) {
                    //Continuing whitespace ignore it.
                    continue;
                } else {
                    //New WhiteSpace

                    //Replace whitespace with a single space.
                    sb.Append(' ');
                    //Set iswhite to True and any following whitespace will be ignored
                    iswhite = true;
                }
            } else {
                sb.Append(c); // c.ToString()
                              //reset iswhitespace to false
                iswhite = false;
            }
        }
        return sb.ToString();
    }

    private class AddressData // : ICloneable, IEquatable<PhoneData>
    {
        public AddressData() {
        }

        public Guid? ContactPublicKey;
        public int? Ordinal;
        public string? Address1;
        public string? Address2;
        public string? ZipCode;
        public string? LocationName;
        public string? City;
        public string? State;
        public string? Country;

        public AddressData Clone() {
            return new AddressData {
                ContactPublicKey = ContactPublicKey,
                Ordinal = Ordinal,
                Address1 = Address1,
                Address2 = Address2,
                ZipCode = ZipCode,
                LocationName = LocationName,
                City = City,
                State = State,
                Country = Country,
                //DBRowVersion = this.DBRowVersion
            };
        }
    }
}
