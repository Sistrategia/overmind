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

    public int? DisplayOrder {
        get => CurrentData.DisplayOrder;
        set => CurrentData.DisplayOrder = value;
    }

    public bool IsPublic {
        get => CurrentData.IsPublic;
        set => CurrentData.IsPublic = value;
    }

    public string? StreetName {
        get => CurrentData.StreetName;
        set => CurrentData.StreetName = value;
    }

    public string? ExtNumber {
        get => CurrentData.ExtNumber;
        set => CurrentData.ExtNumber = value;
    }

    public string? IntNumber {
        get => CurrentData.IntNumber;
        set => CurrentData.IntNumber = value;
    }

    public string? Colony {
        get => CurrentData.Colony;
        set => CurrentData.Colony = value;
    }

    public string? County {
        get => CurrentData.County;
        set => CurrentData.County = value;
    }

    public string? References {
        get => CurrentData.References;
        set => CurrentData.References = value;
    }

    public int? CountryId {
        get => CurrentData.CountryId;
        set => CurrentData.CountryId = value;
    }

    public int? StateId {
        get => CurrentData.StateId;
        set => CurrentData.StateId = value;
    }

    public int? CityId {
        get => CurrentData.CityId;
        set => CurrentData.CityId = value;
    }

    public int? CountyId {
        get => CurrentData.CountyId;
        set => CurrentData.CountyId = value;
    }

    public int? ColonyId {
        get => CurrentData.ColonyId;
        set => CurrentData.ColonyId = value;
    }

    public string? DisplayName {
        get {
            return string.Join(", ", new[] { StreetName is null ? Address1 : $"{StreetName} {ExtNumber} {IntNumber}".TrimEnd(), Address2, Colony, ZipCode, City, County, State, Country }.Where(x => !string.IsNullOrEmpty(x)));
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
        set { CurrentData.ZipCode = value; }
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

    /// <summary>Accept the current exact value and association state for change tracking.</summary>
    public void AcceptChanges() => OriginalData.CopyValuesFrom(CurrentData);
    public void RejectChanges() => CurrentData.CopyValuesFrom(OriginalData);
    public bool HasChanges() => !CurrentData.SameValues(OriginalData);

    private class AddressData
    {
        public AddressData() {
        }

        public int? DisplayOrder;
        public bool IsPublic;
        public string? StreetName;
        public string? ExtNumber;
        public string? IntNumber;
        public string? Colony;
        public string? County;
        public string? References;
        public int? CountryId;
        public int? StateId;
        public int? CityId;
        public int? CountyId;
        public int? ColonyId;
        public Guid? ContactPublicKey;
        public int? Ordinal;
        public string? Address1;
        public string? Address2;
        public string? ZipCode;
        public string? LocationName;
        public string? City;
        public string? State;
        public string? Country;

        public void CopyValuesFrom(AddressData source) {
            ContactPublicKey = source.ContactPublicKey;
            Ordinal = source.Ordinal;
            Address1 = source.Address1;
            Address2 = source.Address2;
            ZipCode = source.ZipCode;
            LocationName = source.LocationName;
            City = source.City;
            State = source.State;
            Country = source.Country;
            DisplayOrder = source.DisplayOrder;
            IsPublic = source.IsPublic;
            StreetName = source.StreetName;
            ExtNumber = source.ExtNumber;
            IntNumber = source.IntNumber;
            Colony = source.Colony;
            County = source.County;
            References = source.References;
            CountryId = source.CountryId;
            StateId = source.StateId;
            CityId = source.CityId;
            CountyId = source.CountyId;
            ColonyId = source.ColonyId;
        }
        public bool SameValues(AddressData other) =>
            ContactPublicKey == other.ContactPublicKey
            && Ordinal == other.Ordinal
            && Address1 == other.Address1
            && Address2 == other.Address2
            && ZipCode == other.ZipCode
            && LocationName == other.LocationName
            && City == other.City
            && State == other.State
            && Country == other.Country
            && DisplayOrder == other.DisplayOrder
            && IsPublic == other.IsPublic
            && StreetName == other.StreetName
            && ExtNumber == other.ExtNumber
            && IntNumber == other.IntNumber
            && Colony == other.Colony
            && County == other.County
            && References == other.References
            && CountryId == other.CountryId
            && StateId == other.StateId
            && CityId == other.CityId
            && CountyId == other.CountyId
            && ColonyId == other.ColonyId;

        public AddressData Clone() {
            return new AddressData {
                DisplayOrder = DisplayOrder,
                IsPublic = IsPublic,
                StreetName = StreetName,
                ExtNumber = ExtNumber,
                IntNumber = IntNumber,
                Colony = Colony,
                County = County,
                References = References,
                CountryId = CountryId,
                StateId = StateId,
                CityId = CityId,
                CountyId = CountyId,
                ColonyId = ColonyId,
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
