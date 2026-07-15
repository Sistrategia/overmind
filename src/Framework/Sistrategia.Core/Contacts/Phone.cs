// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Contacts;

public class Phone
{
    #region Private Members

    private readonly PhoneData currentData;
    private readonly PhoneData originalData;

    #endregion

    #region Constructors

    public Phone() {
        currentData = new PhoneData();
        originalData = new PhoneData();
        // AcceptChanges();
    }

    #endregion

    private PhoneData CurrentData => currentData;
    private PhoneData OriginalData => originalData;

    public string? ContactPublicKey {
        get { return CurrentData.ContactPublicKey?.ToString("N"); }
        set {
            CurrentData.ContactPublicKey = string.IsNullOrEmpty(value) ?
                null : (Guid?)Guid.Parse(value);
        }
    }

    public void AcceptChanges() {
        OriginalData.CopyValuesFrom(CurrentData);
    }

    public void RejectChanges() {
        CurrentData.CopyValuesFrom(OriginalData);
    }

    public bool HasChanges() {
        return !CurrentData.Equals(OriginalData);
    }

    public int? Ordinal {
        get { return CurrentData.Ordinal; }
        set { CurrentData.Ordinal = value; }
    }

    public void SetPhoneNumber(string? fullPhoneNumber) {

        if (!string.IsNullOrEmpty(fullPhoneNumber)) {
            var numbersOnly = GetNumbersOnly(fullPhoneNumber);
            if (!string.IsNullOrEmpty(numbersOnly)) {
                this.NumbersOnly = numbersOnly;
                if (numbersOnly?.Length > 9 && IsLocalNumber8forMX(numbersOnly)) {
                    this.PhoneNumber = Get8LocalNumber(numbersOnly);

                    if (!string.IsNullOrEmpty(this.PhoneNumber) && this.PhoneNumber.Length > 7)
                        this.PhoneNumber = this.PhoneNumber.Substring(0, this.PhoneNumber.Length - 4) + "-" + this.PhoneNumber.Substring(this.PhoneNumber.Length - 4);
                    // phone.CountryCode = "52";
                    this.AreaCode = Get10LocalNumber(numbersOnly)?.Substring(0, 2);
                } else if (numbersOnly?.Length > 9) {
                    this.PhoneNumber = Get7LocalNumber(numbersOnly);
                    if (!string.IsNullOrEmpty(this.PhoneNumber) && this.PhoneNumber.Length > 5)
                        this.PhoneNumber = this.PhoneNumber.Substring(0, this.PhoneNumber.Length - 4) + "-" + this.PhoneNumber.Substring(this.PhoneNumber.Length - 4);
                    this.AreaCode = Get10LocalNumber(numbersOnly)?.Substring(0, 3);
                } else {
                    this.PhoneNumber = numbersOnly;
                    // phone.AreaCode = "55";
                }
            }
        }

    }

    public string? PhoneNumber {
        get { return CurrentData.PhoneNumber; }
        set { CurrentData.PhoneNumber = value; }
    }

    public string? NumbersOnly {
        get { return CurrentData.NumbersOnly; }
        set { CurrentData.NumbersOnly = value; }
    }

    public string? AreaCode {
        get { return CurrentData.AreaCode; }
        set { CurrentData.AreaCode = value?.Trim(); }
    }

    public string? Extension {
        get { return CurrentData.Extension; }
        set { CurrentData.Extension = value; }
    }

    public string? FormattedNumber {
        get {
            if (!string.IsNullOrEmpty(CurrentData.AreaCode))
                return string.IsNullOrEmpty(CurrentData.Extension) ? $"({CurrentData.AreaCode}) {CurrentData.PhoneNumber}" : $"({CurrentData.AreaCode}) {CurrentData.PhoneNumber} {Extension}";
            else
                return string.IsNullOrEmpty(CurrentData.Extension) ? CurrentData.PhoneNumber : $"{CurrentData.PhoneNumber} {Extension}";
        }
    }

    public string? LocationName {
        get { return CurrentData.LocationName; }
        set { CurrentData.LocationName = value; }
    }

    public static string? GetNumbersOnly(string? phoneNumber) {
        if (string.IsNullOrEmpty(phoneNumber)) return null;
        return new string(phoneNumber.Where(char.IsDigit).ToArray()); // +52 1 55 1234 5678 => 5215512345678
    }

    public static string? Get10LocalNumber(string? phoneNumber) {
        var numbersOnly = GetNumbersOnly(phoneNumber);
        string? localNumber = null;
        if (string.IsNullOrEmpty(numbersOnly)) return null;

        if (numbersOnly.Length > 10)
            localNumber = numbersOnly.Substring(numbersOnly.Length - 10); // 5215512345678 => 5512345678
        else
            localNumber = numbersOnly;

        return localNumber;
    }

    public static string? Get8LocalNumber(string? phoneNumber) {
        var numbersOnly = Get10LocalNumber(phoneNumber);
        string? localNumber = null;
        if (string.IsNullOrEmpty(numbersOnly)) return null;

        if (numbersOnly.Length > 8)
            localNumber = numbersOnly.Substring(numbersOnly.Length - 8); // 5215512345678 => 12345678
        else
            localNumber = numbersOnly;

        return localNumber;
    }

    public static string? Get7LocalNumber(string? phoneNumber) {
        var numbersOnly = Get10LocalNumber(phoneNumber);
        string? localNumber = null;
        if (string.IsNullOrEmpty(numbersOnly)) return null;

        if (numbersOnly.Length > 7)
            localNumber = numbersOnly.Substring(numbersOnly.Length - 7); // 5215512345678 => 12345678
        else
            localNumber = numbersOnly;

        return localNumber;
    }

    public static bool IsLocalNumber8forMX(string? phoneNumber) {
        var numbersOnly = Get10LocalNumber(phoneNumber);
        if (string.IsNullOrEmpty(numbersOnly)) return false;
        return (numbersOnly.StartsWith("55") // CDMX
            || numbersOnly.StartsWith("33")  // GDL
            || numbersOnly.StartsWith("81")); // MTY
    }

    private class PhoneData : ICloneable, IEquatable<PhoneData>
    {
        public PhoneData() {
        }

        public Guid? ContactPublicKey;
        public int? Ordinal;
        public string? PhoneNumber;
        public string? NumbersOnly;
        public string? AreaCode;
        public string? Extension;
        public string? LocationName;
        public string? City;
        public string? State;
        public string? Country;

        public PhoneData Clone() {
            return new PhoneData {
                ContactPublicKey = ContactPublicKey,
                Ordinal = Ordinal,
                PhoneNumber = PhoneNumber,
                AreaCode = AreaCode,
                Extension = Extension,
                LocationName = LocationName,
                City = City,
                State = State,
                Country = Country,
                //DBRowVersion = this.DBRowVersion
            };
        }

        public void CopyValuesFrom(PhoneData source) {
            ContactPublicKey = source.ContactPublicKey;
            Ordinal = source.Ordinal;
            PhoneNumber = source.PhoneNumber;
            AreaCode = source.AreaCode;
            Extension = source.Extension;
            LocationName = source.LocationName;
            City = source.City;
            State = source.State;
            Country = source.Country;
        }

        object ICloneable.Clone() {
            return Clone();
        }

        public bool Equals(PhoneData? other) {
            return (
            ContactPublicKey == other?.ContactPublicKey
            && Ordinal == other?.Ordinal
            && PhoneNumber == other?.PhoneNumber
            && AreaCode == other?.AreaCode
            && Extension == other?.Extension
            && LocationName == other?.LocationName
            && City == other?.City
            && State == other?.State
            && Country == other?.Country);
        }

        public override bool Equals(object? other) {
            return Equals(other as PhoneData);
        }

        public override int GetHashCode() {
            var hash = new HashCode();
            hash.Add(ContactPublicKey);
            hash.Add(Ordinal);
            hash.Add(PhoneNumber);
            hash.Add(AreaCode);
            hash.Add(Extension);
            hash.Add(LocationName);
            hash.Add(City);
            hash.Add(State);
            hash.Add(Country);
            return hash.ToHashCode();
        }
    }
}


//SELECT e.[public_key], c.[contact_id], c.[contact_type_id], e.[display_name]
//, cp.[ordinal], p.[phone_id], p.[phone_number], p.[area_code]
//, p.[city_id], ci.[city]
//, p.[state_id], s.[state]
//, p.[country_id], co.[country] 