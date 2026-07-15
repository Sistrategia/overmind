/*************************************************************************************************************
* Party.cs is part of the Sistrategia Core Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):	J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:		2022-Jan-04
* Created:			2010-Sep-08
* Version:			6.0.6829.0
*************************************************************************************************************/


namespace Sistrategia.Contacts;

public class Person : Contact, IPerson
{
    public Person()
        : base(PartyType.Person) { }

    public string? PersonTitle {
        get { return CurrentData.PersonTitle; }
        set {
            this.CurrentData.PersonTitle = NormalizeWhiteSpace(value);
            this.UpdateFullName();
            this.UpdateDisplayName();
            this.UpdateSummary();
        }
    }

    public string? FirstName {
        get { return CurrentData.FirstName; }
        set {
            CurrentData.FirstName = NormalizeWhiteSpace(value);
            UpdateFullName();
            UpdateDisplayName();
            UpdateSummary();
        }
    }

    public string? LastName {
        get { return CurrentData.LastName; }
        set {
            CurrentData.LastName1 = null;
            CurrentData.LastName2 = null;
            CurrentData.LastName = NormalizeWhiteSpace(value);
            UpdateFullName();
            UpdateDisplayName();
            UpdateSummary();
        }
    }

    public string? LastName1 {
        get { return CurrentData.LastName1; }
        set {
            CurrentData.LastName1 = NormalizeWhiteSpace(value);
            UpdateLastName();
            UpdateFullName();
            UpdateDisplayName();
            UpdateSummary();
        }
    }

    public string? LastName2 {
        get { return CurrentData.LastName2; }
        set {
            CurrentData.LastName2 = NormalizeWhiteSpace(value);
            UpdateLastName();
            UpdateFullName();
            UpdateDisplayName();
            UpdateSummary();
        }
    }

    public string? Suffix {
        get { return CurrentData.Suffix; }
        set { CurrentData.Suffix = NormalizeWhiteSpace(value); }
    }

    public string? Alias {
        get { return CurrentData.Alias; }
        set { CurrentData.Alias = NormalizeWhiteSpace(value); }
    }

    public string? JobTitle {
        get => CurrentData.JobTitle;
        set {
            CurrentData.JobTitle = NormalizeWhiteSpace(value);
            //this.UpdateContactListInfoCard();
        }
    }

    public string? Company {
        get => CurrentData.PersonCompany;
        set {
            CurrentData.PersonCompany = NormalizeWhiteSpace(value);
            //this.UpdateContactListInfoCard();
        }
    }

    public string? CompanyPublicKey {
        get => CurrentData.PersonCompanyPublicKey;
        set {
            CurrentData.PersonCompanyPublicKey = value;
            //this.UpdateContactListInfoCard();
        }
    }
    //public string? CompanyPublicKey {
    //    get { return CurrentData.PersonCompanyPublicKey?.ToString("N"); }
    //    set {
    //        CurrentData.PersonCompanyPublicKey = string.IsNullOrEmpty(value) ?
    //            null : (Guid?)Guid.Parse(value);
    //    }
    //}

    public string? Division {
        get => CurrentData.PersonDivision;
        set {
            CurrentData.PersonDivision = NormalizeWhiteSpace(value);
            //this.UpdateContactListInfoCard();
        }
    }

    public string? DivisionPublicKey {
        get => CurrentData.PersonDivisionPublicKey;
        set {
            CurrentData.PersonDivisionPublicKey = value;
            //this.UpdateContactListInfoCard();
        }
    }

    public DateOnly? Birthdate {
        get => CurrentData.PersonBirthdate;
        set => CurrentData.PersonBirthdate = value;
    }
    public string? GenderCode {
        get => CurrentData.PersonGenderCode;
        set => CurrentData.PersonGenderCode = value;
    }

    public string? MaritalStatus {
        get => CurrentData.PersonMaritalStatus;
        set => CurrentData.PersonMaritalStatus = value;
    }

    public string? BirthCity {
        get => CurrentData.PersonBirthCity;
        set => CurrentData.PersonBirthCity = value;
    }
    public string? BirthState {
        get => CurrentData.PersonBirthState;
        set => CurrentData.PersonBirthState = value;
    }
    public string? BirthCountry {
        get => CurrentData.PersonBirthCountry;
        set => CurrentData.PersonBirthCountry = value;
    }

    //public override string? ContactListInfoCard1 => $"{JobTitle} en {Company}";
    //public override string? ContactListInfoCard2 => $"{JobTitle} en {Company}";

    public override string? ContactListInfoCard1 => JobTitle;
    public override string? ContactListInfoCard2 => Company;

    //protected override void UpdateContactListInfoCard() {
    //    CurrentData.ContactListInfoCard1 = $"{JobTitle} en {Company}";
    //}

    protected override void UpdateDisplayName() {
        CurrentData.DisplayName = string.IsNullOrWhiteSpace(PersonTitle) ?
                FullName : PersonTitle + " " + FullName;
    }

    protected override void UpdateFullName() {
        if (!string.IsNullOrEmpty(FirstName) && !string.IsNullOrEmpty(LastName1) && !string.IsNullOrEmpty(LastName2)) {
            CurrentData.FullName = NormalizeWhiteSpace(FirstName + ' ' + LastName1 + ' ' + LastName2);
        } else if (!string.IsNullOrEmpty(FirstName) && !string.IsNullOrEmpty(LastName1) && string.IsNullOrEmpty(LastName2)) {
            CurrentData.FullName = NormalizeWhiteSpace(FirstName + ' ' + LastName1);
        } else if (!string.IsNullOrEmpty(FirstName) && string.IsNullOrEmpty(LastName1) && string.IsNullOrEmpty(LastName2)) {
            CurrentData.FullName = NormalizeWhiteSpace(FirstName);
        } else if (string.IsNullOrEmpty(FirstName) && !string.IsNullOrEmpty(LastName1) && string.IsNullOrEmpty(LastName2)) {
            CurrentData.FullName = NormalizeWhiteSpace(LastName1);
        } else {
            CurrentData.FullName = NormalizeWhiteSpace(FirstName + ' ' + LastName1 + ' ' + LastName2);
        }
    }

    protected virtual void UpdateLastName() {
        CurrentData.LastName = CurrentData.LastName1;
        if (!string.IsNullOrEmpty(CurrentData.LastName2)) {
            CurrentData.LastName = CurrentData.LastName1 + ' ' + CurrentData.LastName2; // EntityManager.NormalizeWhiteSpace(PersonLastName1 + ' ' + PersonLastName2);
        }
    }
}
