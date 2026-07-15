// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Contacts;

/// <summary>
/// A collection of web links (URLs) for a contact.
/// Follows the same pattern as EmailCollection, PhoneCollection, and AddressCollection.
/// </summary>
public class WebLinkCollection : IEnumerable<WebLink>
{
    #region Private Fields    
    private readonly IContact contact;
    private readonly List<WebLink> entityList = new();
    #endregion

    internal WebLinkCollection(IContact contact) {
        this.contact = contact;
    }

    /// <summary>
    /// The contact that owns this collection.
    /// </summary>
    public IContact Owner => contact;

    /// <summary>
    /// Get or set a web link by location name.
    /// </summary>
    public WebLink? this[string locationName] {
        get {
            if (string.IsNullOrEmpty(locationName))
                throw new ArgumentNullException(nameof(locationName));
            return entityList.Find(w => locationName.Equals(w.LocationName, StringComparison.OrdinalIgnoreCase));
        }
        set {
            if (string.IsNullOrEmpty(locationName))
                throw new ArgumentNullException(nameof(locationName));
            if (value is null)
                throw new ArgumentNullException(nameof(value));

            var webLink = entityList.Find(w => locationName.Equals(w.LocationName, StringComparison.OrdinalIgnoreCase));
            if (webLink is null) {
                Add(value);
            } else {
                webLink.Url = value.Url;
                webLink.LinkType = value.LinkType;
                webLink.LocationName = value.LocationName;
                webLink.DisplayText = value.DisplayText;
            }
        }
    }

    /// <summary>
    /// Get or set a web link by index.
    /// </summary>
    public WebLink? this[int index] {
        get { return entityList[index]; }
        set {
            if (value is null)
                throw new ArgumentNullException(nameof(value));
            entityList[index] = value;
        }
    }

    /// <summary>
    /// Get the number of web links in this collection.
    /// </summary>
    public int Count => entityList.Count;

    /// <summary>
    /// Get all links of a specific type (e.g., all "facebook" links).
    /// </summary>
    /// <param name="linkType">The link type to filter by (e.g., "facebook", "linkedin").</param>
    public IEnumerable<WebLink> ByType(string linkType) {
        return entityList.Where(w => linkType.Equals(w.LinkType, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Get the first link of a specific type.
    /// </summary>
    /// <param name="linkType">The link type to find (e.g., "facebook", "linkedin").</param>
    public WebLink? FirstOfType(string linkType) {
        return entityList.Find(w => linkType.Equals(w.LinkType, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Add a web link to the collection.
    /// </summary>
    public void Add(WebLink webLink) {
        if (webLink is null)
            throw new ArgumentNullException(nameof(webLink));

        entityList.Add(webLink);
        webLink.Ordinal = entityList.IndexOf(webLink) + 1;
    }

    /// <summary>
    /// Add a web link with the specified URL and type.
    /// </summary>
    /// <param name="url">The URL of the web link.</param>
    /// <param name="linkType">The type of link (e.g., "facebook", "website").</param>
    /// <param name="locationName">Optional label for the link.</param>
    /// <returns>The created WebLink instance.</returns>
    public WebLink Add(string url, string linkType, string? locationName = null) {
        if (string.IsNullOrEmpty(url))
            throw new ArgumentNullException(nameof(url));
        if (string.IsNullOrEmpty(linkType))
            throw new ArgumentNullException(nameof(linkType));

        var webLink = new WebLink {
            Url = url.Trim(),
            LinkType = linkType.ToLowerInvariant(),
            LocationName = locationName?.Trim()
        };
        Add(webLink);
        return webLink;
    }

    /// <summary>
    /// Add multiple web links to the collection.
    /// </summary>
    public void AddRange(IEnumerable<WebLink> enumerable) {
        if (enumerable is null)
            throw new ArgumentNullException(nameof(enumerable));

        foreach (var webLink in enumerable) {
            Add(webLink);
        }
    }

    IEnumerator<WebLink> IEnumerable<WebLink>.GetEnumerator() {
        return entityList.GetEnumerator();
    }

    System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() {
        return entityList.GetEnumerator();
    }
}
