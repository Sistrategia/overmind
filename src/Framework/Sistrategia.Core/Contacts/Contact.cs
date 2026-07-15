// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

using System.Text;
using Sistrategia.Entities;

namespace Sistrategia.Contacts;

//public class Contact : ContactInfo, IContact, IParty
public abstract class Contact : EntityBase, IContact, IParty
{
    private readonly EmailCollection emails;
    private readonly PhoneCollection phones;
    private readonly AddressCollection addresses;
    private readonly WebLinkCollection webLinks;

    //public Contact(PartyType partyType) : base(partyType) {
    //}
    public Contact(PartyType partyType) : base(new ContactData(), new ContactData()) {
        PartyType = partyType;
        PublicKey = Guid.NewGuid().ToString("N");
        emails = new EmailCollection(this);
        phones = new PhoneCollection(this);
        addresses = new AddressCollection(this);
        webLinks = new WebLinkCollection(this);
    }

    protected Contact(PartyType partyType, ContactData currentData, ContactData originalData) : base(currentData, originalData) {
        PartyType = partyType;
        PublicKey = Guid.NewGuid().ToString("N");
        emails = new EmailCollection(this);
        phones = new PhoneCollection(this);
        addresses = new AddressCollection(this);
        webLinks = new WebLinkCollection(this);
    }

    protected new ContactData CurrentData {
        get {
            return (ContactData)base.CurrentData;
        }
    }

    public PartyType PartyType {
        get { return CurrentData.PartyType; }
        set { CurrentData.PartyType = value; }
    }

    public string? FullName {
        get { return CurrentData.FullName; }
        set {
            CurrentData.FullName = value;
            UpdateDisplayName();
        }
    }

    public bool IsPerson => PartyType == PartyType.Person;
    public bool IsOrganization => PartyType == PartyType.Organization;
    public bool IsGroup => PartyType == PartyType.Group;

    public override string? DisplayName {
        get { return CurrentData.DisplayName; }
        set { CurrentData.DisplayName = value?.Trim(); }
    }

    public virtual string? Subtitle => $"{ContactListInfoCard1}/{ContactListInfoCard2}";

    public virtual string? EmailAddress { get; set; }
    public virtual string? PhoneNumber { get; set; }

    public EmailCollection Emails => emails;
    public PhoneCollection Phones => phones;
    public AddressCollection Addresses => addresses;
    public WebLinkCollection WebLinks => webLinks;

    public string? LineOfBusiness { get; set; }

    public abstract string? ContactListInfoCard1 { get; }
    public abstract string? ContactListInfoCard2 { get; }

    public string? PrimaryGroup { get; set; }
    public string? PrimaryGroupPublicKey { get; set; }

    /// <summary>
    /// Indicates if this contact is actively seeking opportunities.
    /// Primarily used by alumni to signal they are open to job offers.
    /// </summary>
    public bool OpenToWork {
        get { return CurrentData.OpenToWork; }
        set { CurrentData.OpenToWork = value; }
    }

    /// <summary>
    /// Indicates if this contact is actively recruiting/hiring.
    /// Used by organizations and independent professionals seeking candidates.
    /// </summary>
    public bool Recruiting {
        get { return CurrentData.Recruiting; }
        set { CurrentData.Recruiting = value; }
    }

    /// <summary>
    /// Indicates if this contact (person) is deceased.
    /// Admin-only field used to replace legacy "FINADO" prefix pattern.
    /// Deceased contacts are excluded from employer searches.
    /// </summary>
    public bool IsDeceased {
        get { return CurrentData.IsDeceased; }
        set { CurrentData.IsDeceased = value; }
    }

    protected virtual void UpdateFullName() {
        this.CurrentData.FullName = NormalizeWhiteSpace(FullName);
    }

    protected virtual void UpdateDisplayName() {
        CurrentData.DisplayName = FullName;
    }

    protected virtual void UpdateSummary() {
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

    public static Contact Create(PartyType partyType) {
        if (partyType == PartyType.Person) {
            return new Person();
        } else if (partyType == PartyType.Organization) {
            return new Organization();
        } else {
            return new Group();
        }
    }

    #region Internal ContactData

    protected class ContactData : EntityData
    {

        public ContactData() : base() {
            PartyType = PartyType.Person;
        }

        //private Guid? publicKey;
        public PartyType PartyType;
        public string? FullName;
        public string? PersonTitle;
        public string? FirstName;
        public string? LastName;
        public string? LastName1;
        public string? LastName2;
        public string? Suffix;
        public string? Alias;
        public string? JobTitle;
        public string? PersonCompany;
        public string? PersonCompanyPublicKey;
        public string? PersonDivision;
        public string? PersonDivisionPublicKey;

        public DateOnly? PersonBirthdate;
        public string? PersonGenderCode;
        public string? PersonMaritalStatus;
        public string? PersonBirthCity;
        public string? PersonBirthState;
        public string? PersonBirthCountry;

        // Career status flags - added 2026-01-08
        public bool OpenToWork;
        public bool Recruiting;
        // Deceased status - added 2026-01-20
        public bool IsDeceased;

        public override ContactData Clone() {
            return new ContactData {
                PublicKey = this.PublicKey,
                LogicalKey = this.LogicalKey,
                DisplayName = this.DisplayName,
                Created = this.Created,
                Modified = this.Modified,
                ModifiedBy = this.ModifiedBy,
                Locked = this.Locked,
                Validated = this.Validated,
                Summary = this.Summary,
                ImageUrl = this.ImageUrl,
                ThumbnailUrl = this.ThumbnailUrl,
                IsPrivate = this.IsPrivate,
                IsSystem = this.IsSystem,

                FullName = this.FullName,
                PersonTitle = this.PersonTitle,
                FirstName = this.FirstName,
                LastName = this.LastName,
                LastName1 = this.LastName1,
                LastName2 = this.LastName2,
                Suffix = this.Suffix,
                Alias = this.Alias,

                JobTitle = this.JobTitle,
                PersonCompany = this.PersonCompany,

                PersonCompanyPublicKey = this.PersonCompanyPublicKey,
                PersonDivision = this.PersonDivision,
                PersonDivisionPublicKey = this.PersonDivisionPublicKey,
                PersonBirthdate = this.PersonBirthdate,
                PersonGenderCode = this.PersonGenderCode,
                PersonMaritalStatus = this.PersonMaritalStatus,
                PersonBirthCity = this.PersonBirthCity,
                PersonBirthState = this.PersonBirthState,
                PersonBirthCountry = this.PersonBirthCountry,

                OpenToWork = this.OpenToWork,
                Recruiting = this.Recruiting,
                IsDeceased = this.IsDeceased,

                DBRowVersion = this.DBRowVersion
            };
        }
    }

    #endregion
}
