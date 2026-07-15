// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Contacts;

/// <summary>
/// Represents a web link (URL) associated with a contact.
/// Used for social media profiles, websites, and other online presence.
/// Follows the same pattern as Email, Phone, and Address contact mechanisms.
/// </summary>
public class WebLink
{
    #region Private Members

    private readonly WebLinkData currentData;
    private readonly WebLinkData originalData;

    #endregion

    #region Constructors

    public WebLink() {
        currentData = new WebLinkData();
        originalData = new WebLinkData();
    }

    #endregion

    private WebLinkData CurrentData => currentData;
    private WebLinkData OriginalData => originalData;

    /// <summary>
    /// The public key of the contact this web link belongs to.
    /// </summary>
    public string? ContactPublicKey {
        get { return CurrentData.ContactPublicKey?.ToString("N"); }
        set {
            CurrentData.ContactPublicKey = string.IsNullOrEmpty(value) ?
                null : (Guid?)Guid.Parse(value);
        }
    }

    /// <summary>
    /// The ordinal position of this web link within the contact's collection.
    /// </summary>
    public int? Ordinal {
        get { return CurrentData.Ordinal; }
        set { CurrentData.Ordinal = value; }
    }

    /// <summary>
    /// The full URL (e.g., "https://facebook.com/username").
    /// </summary>
    public string? Url {
        get { return CurrentData.Url; }
        set { CurrentData.Url = value?.Trim(); }
    }

    /// <summary>
    /// Type of link: website, facebook, instagram, twitter, linkedin, github, youtube, tiktok, other.
    /// </summary>
    public string? LinkType {
        get { return CurrentData.LinkType; }
        set { CurrentData.LinkType = value?.ToLowerInvariant()?.Trim(); }
    }

    /// <summary>
    /// User-friendly label (e.g., "Company Page", "Personal Profile").
    /// </summary>
    public string? LocationName {
        get { return CurrentData.LocationName; }
        set { CurrentData.LocationName = value?.Trim(); }
    }

    /// <summary>
    /// Optional display text (if different from URL).
    /// </summary>
    public string? DisplayText {
        get { return CurrentData.DisplayText; }
        set { CurrentData.DisplayText = value?.Trim(); }
    }

    /// <summary>
    /// Accept the current state as the original state (for change tracking).
    /// </summary>
    public void AcceptChanges() {
        OriginalData.CopyValuesFrom(CurrentData);
    }

    /// <summary>
    /// Revert to the original state (for change tracking).
    /// </summary>
    public void RejectChanges() {
        CurrentData.CopyValuesFrom(OriginalData);
    }

    /// <summary>
    /// Check if there are unsaved changes.
    /// </summary>
    public bool HasChanges() {
        return !CurrentData.Equals(OriginalData);
    }

    #region Internal WebLinkData

    private class WebLinkData : IEquatable<WebLinkData>
    {
        public WebLinkData() {
        }

        public Guid? ContactPublicKey;
        public int? Ordinal;
        public string? Url;
        public string? LinkType;
        public string? LocationName;
        public string? DisplayText;

        public WebLinkData Clone() {
            return new WebLinkData {
                ContactPublicKey = ContactPublicKey,
                Ordinal = Ordinal,
                Url = Url,
                LinkType = LinkType,
                LocationName = LocationName,
                DisplayText = DisplayText,
            };
        }

        public void CopyValuesFrom(WebLinkData source) {
            ContactPublicKey = source.ContactPublicKey;
            Ordinal = source.Ordinal;
            Url = source.Url;
            LinkType = source.LinkType;
            LocationName = source.LocationName;
            DisplayText = source.DisplayText;
        }

        public bool Equals(WebLinkData? other) {
            if (other is null) return false;
            return ContactPublicKey == other.ContactPublicKey
                && Ordinal == other.Ordinal
                && Url == other.Url
                && LinkType == other.LinkType
                && LocationName == other.LocationName
                && DisplayText == other.DisplayText;
        }

        public override bool Equals(object? obj) {
            return Equals(obj as WebLinkData);
        }

        public override int GetHashCode() {
            return HashCode.Combine(ContactPublicKey, Ordinal, Url, LinkType, LocationName, DisplayText);
        }
    }

    #endregion
}
