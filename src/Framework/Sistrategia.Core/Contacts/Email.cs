// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Contacts;

public class Email
{
    #region Private Members

    private readonly EmailData currentData;
    private readonly EmailData originalData;

    #endregion

    #region Constructors

    public Email() {
        currentData = new EmailData();
        originalData = new EmailData();
    }

    #endregion

    private EmailData CurrentData => currentData;
    private EmailData OriginalData => originalData;

    public int? Ordinal {
        get { return CurrentData.Ordinal; }
        set { CurrentData.Ordinal = value; }
    }

    public string? EmailAddress {
        get { return CurrentData.EmailAddress; }
        set { CurrentData.EmailAddress = value; }
    }

    public string? LocationName {
        get { return CurrentData.LocationName; }
        set { CurrentData.LocationName = value; }
    }

    private class EmailData
    {
        public EmailData() {
        }

        public Guid? ContactPublicKey;
        public int? Ordinal;
        public string? EmailAddress;
        public string? LocationName;

        public virtual EmailData Clone() {
            return new EmailData {
                ContactPublicKey = ContactPublicKey,
                Ordinal = Ordinal,
                EmailAddress = EmailAddress,
                LocationName = LocationName,
            };
        }
    }
}
