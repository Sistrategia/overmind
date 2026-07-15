/*************************************************************************************************************
* Entity.cs is part of the Sistrategia.Entities Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):	J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:		2022-Jan-04
* Created:			2010-Sep-08
* Version:			6.0.6829.0
*************************************************************************************************************/

using Sistrategia.Security;

namespace Sistrategia.Entities;

public abstract class EntityBase : IEntity
{
    #region Private Members

    private readonly EntityData currentData;
    private readonly EntityData originalData;
    private List<IEntityIdentifier> identifiers = new List<IEntityIdentifier>();

    #endregion

    #region Constructors

    public EntityBase() {
        currentData = new EntityData();
        originalData = new EntityData();
        //this.originalData = this.currentData.Clone();
        AcceptChanges();
    }

    protected EntityBase(EntityData currentData, EntityData originalData) {
        this.currentData = currentData;
        this.originalData = originalData;
    }

    #endregion

    public IEnumerable<IEntityIdentifier> Identifiers => identifiers;

    #region Public Properties

    protected EntityData CurrentData => currentData;
    protected EntityData OriginalData => originalData;

    public string? PublicKey {
        get { return CurrentData.PublicKey?.ToString("N"); }
        set {
            CurrentData.PublicKey = string.IsNullOrEmpty(value) ?
                null : (Guid?)Guid.Parse(value);
        }
    }

    public string? Tenant {
        get { return CurrentData.Tenant?.ToString("N"); }
        set {
            CurrentData.Tenant = string.IsNullOrEmpty(value) ?
                null : (Guid?)Guid.Parse(value);
        }
    }

    public string? TenantName {
        get { return CurrentData.TenantName; }
        set { CurrentData.TenantName = value; }
    }

    public string? LogicalKey {
        get { return CurrentData.LogicalKey; }
        set { CurrentData.LogicalKey = value; }
    }

    public virtual string? DisplayName {
        get { return CurrentData.DisplayName; }
        set { CurrentData.DisplayName = value; }
    }

    #region IAuditable

    public DateTime Created {
        get { return CurrentData.Created; }
        set { CurrentData.Created = value; }
    }

    public DateTime Modified {
        get { return CurrentData.Modified; }
        set { CurrentData.Modified = value; }
    }

    public UserInfo ModifiedBy {
        get { return CurrentData.ModifiedBy; }
        set { CurrentData.ModifiedBy = value; }
    }

    #endregion

    #region ILockable        

    public DateTime? Locked {
        get { return CurrentData.Locked; }
        set { CurrentData.Locked = value; }
    }

    public bool IsLocked => Locked.HasValue;

    #endregion

    #region IValidatable        

    public DateTime? Validated {
        get { return CurrentData.Validated; }
        set { CurrentData.Validated = value; }
    }

    public bool IsValidated => Validated.HasValue;

    #endregion

    #region ISummarizable

    public string? Summary {
        get { return CurrentData.Summary; }
        set { CurrentData.Summary = value; }
    }

    #endregion

    #region IImageable

    public string? ImageUrl {
        get { return CurrentData.ImageUrl; }
        set { CurrentData.ImageUrl = value; }
    }

    #endregion

    #region IThumbnailable

    public string? ThumbnailUrl {
        get { return CurrentData.ThumbnailUrl; }
        set { CurrentData.ThumbnailUrl = value; }
    }

    #endregion

    #region IPrivatelyOwnable

    public bool IsPrivate {
        get { return CurrentData.IsPrivate; }
        set { CurrentData.IsPrivate = value; }
    }

    #endregion

    #region ISystemOwnable

    public bool IsSystem {
        get { return CurrentData.IsSystem; }
        set { CurrentData.IsSystem = value; }
    }

    #endregion

    #region IVersionable

    public long? DBRowVersion {
        get { return CurrentData.DBRowVersion; }
        set { CurrentData.DBRowVersion = value; }
    }

    //public int? Year {
    //    get { return CurrentData.Year; }
    //    set { CurrentData.Year = value; }
    //}

    //public int? Month {
    //    get { return CurrentData.Month; }
    //    set { CurrentData.Month = value; }
    //}

    //public int? DocumentsCount {
    //    get { return CurrentData.DocumentsCount; }
    //    set { CurrentData.DocumentsCount = value; }
    //}

    //public int? ComplianceRate {
    //    get { return CurrentData.ComplianceRate; }
    //    set { CurrentData.ComplianceRate = value; }
    //}

    //internal void SetDBRowVersion(long? dbRowVersion) {
    //    this.CurrentData.DBRowVersion = dbRowVersion;
    //}

    #endregion

    #endregion

    public void AddIdentifier(IEntityIdentifier identifier) {
        identifiers.Add(identifier);
    }

    #region Internal Entity Data

    public virtual void AcceptChanges() {
        OriginalData.PublicKey = CurrentData.PublicKey;
        OriginalData.LogicalKey = CurrentData.LogicalKey;
        OriginalData.DisplayName = CurrentData.DisplayName;
        OriginalData.Created = CurrentData.Created;
        //OriginalData.CreatedBy = CurrentData.CreatedBy;
        OriginalData.Modified = CurrentData.Modified;
        OriginalData.ModifiedBy = CurrentData.ModifiedBy;
        //OriginalData.Deleted = CurrentData.Deleted;
        //OriginalData.DeletedBy = CurrentData.DeletedBy;
        OriginalData.Locked = CurrentData.Locked;
        //OriginalData.LockedBy = CurrentData.LockedBy;
        OriginalData.Validated = CurrentData.Validated;
        //OriginalData.ValidatedBy = CurrentData.ValidatedBy;
        OriginalData.Summary = CurrentData.Summary;
        OriginalData.ImageUrl = CurrentData.ImageUrl;
        OriginalData.ThumbnailUrl = CurrentData.ThumbnailUrl;
        OriginalData.IsPrivate = CurrentData.IsPrivate;
        OriginalData.IsSystem = CurrentData.IsSystem;
        OriginalData.DBRowVersion = CurrentData.DBRowVersion;
        //OriginalData.Year = CurrentData.Year;
        //OriginalData.Month = CurrentData.Month;
        //OriginalData.DocumentsCount = CurrentData.DocumentsCount;
        //OriginalData.ComplianceRate = CurrentData.ComplianceRate;
    }

    protected class EntityData
    {
        public EntityData() {
            Tenant = new Guid("46BE0A72-4301-4F02-9EBD-6EEBA985B746");
            Modified = DateTime.UtcNow;
            ModifiedBy = new UserInfo {
                PublicKey = new Guid("71F092F4-3A35-463D-9589-E5EE1373F7D5").ToString("N"),
                DisplayName = "System User",
                ThumbnailUrl = null,
                EmailAddress = null,
            };
        }

        public Guid? PublicKey;
        public Guid? Tenant;
        public string? TenantName;
        public string? LogicalKey;
        public string? DisplayName;
        public DateTime Created;
        //public IUserInfo CreatedBy;
        public DateTime Modified;
        public UserInfo ModifiedBy;
        //public DateTime? Deleted;
        //public IUserInfo? DeletedBy;
        public DateTime? Locked;
        //public IUserInfo? LockedBy;
        public DateTime? Validated;
        //public IUserInfo? ValidatedBy;

        public string? Summary;
        public string? ImageUrl;
        public string? ThumbnailUrl;

        public bool IsPrivate;
        public bool IsSystem;

        //public int? Year = null;
        //public int? Month = null;

        //public int? DocumentsCount = null;
        //public int? ComplianceRate = null;

        public long? DBRowVersion;

        public virtual EntityData Clone() {
            return new EntityData {
                Tenant = this.Tenant,
                TenantName = this.TenantName,
                PublicKey = this.PublicKey,
                LogicalKey = this.LogicalKey,
                DisplayName = this.DisplayName,
                Created = this.Created,
                //CreatedBy = this.CreatedBy,
                Modified = this.Modified,
                ModifiedBy = this.ModifiedBy,
                //Deleted = this.Deleted,
                //DeletedBy = this.DeletedBy,
                Locked = this.Locked,
                //LockedBy = this.LockedBy,
                Validated = this.Validated,
                //ValidatedBy = this.ValidatedBy,
                Summary = this.Summary,
                ImageUrl = this.ImageUrl,
                ThumbnailUrl = this.ThumbnailUrl,
                IsPrivate = this.IsPrivate,
                IsSystem = this.IsSystem,
                //Year = this.Year,
                //Month = this.Month,
                //DocumentsCount = this.DocumentsCount,
                //ComplianceRate = this.ComplianceRate,
                DBRowVersion = this.DBRowVersion
            };
        }
    }

    #endregion
}
