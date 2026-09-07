// Copyright (c) Sistrategia. All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root.

namespace Sistrategia.Data.SqlClient;

/// <summary>Exact HTTP/HTTPS URL and contact-owned metadata. Validation never rewrites input.</summary>
public sealed record WebLinkInput(string Url, string? LinkType = null, string? DisplayText = null)
{
    public void Validate() {
        if (string.IsNullOrEmpty(Url) || Url.Length > 2048 || Url.Any(c => char.IsControl(c) || char.IsWhiteSpace(c))
            || Url.Contains('\\') || !Uri.TryCreate(Url, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            || string.IsNullOrEmpty(uri.Host) || !string.IsNullOrEmpty(uri.UserInfo)
            || !Url.StartsWith(uri.Scheme + "://", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Supply an absolute HTTP/HTTPS URL of at most 2048 UTF-16 units, without credentials, whitespace, controls or backslashes.", nameof(Url));
        var authorityStart = Url.IndexOf("://", StringComparison.Ordinal) + 3;
        var authorityEnd = Url.IndexOfAny(['/', '?', '#'], authorityStart);
        if (Url.AsSpan(authorityStart, (authorityEnd < 0 ? Url.Length : authorityEnd) - authorityStart).Contains('@'))
            throw new ArgumentException("URL authority cannot contain credentials.", nameof(Url));
        for (var i = 0; i < Url.Length; i++) {
            if (Url[i] == '%' && (i + 2 >= Url.Length || !Uri.IsHexDigit(Url[i + 1]) || !Uri.IsHexDigit(Url[i + 2])))
                throw new ArgumentException("URL percent escapes must contain two hexadecimal digits.", nameof(Url));
            if (char.IsSurrogate(Url[i])) {
                if (!char.IsHighSurrogate(Url[i]) || i + 1 >= Url.Length || !char.IsLowSurrogate(Url[i + 1]))
                    throw new ArgumentException("URL contains an unpaired UTF-16 surrogate.", nameof(Url));
                i++;
            }
        }
        if (LinkType is not null && (LinkType.Length is < 1 or > 50
            || LinkType.Any(c => !(c is >= 'a' and <= 'z' or >= '0' and <= '9' or '_' or '-'))))
            throw new ArgumentException("Link type must be 1 to 50 lowercase ASCII letters, digits, underscores or hyphens.", nameof(LinkType));
        if (DisplayText?.Length > 256)
            throw new ArgumentException("Display text exceeds 256 UTF-16 units.", nameof(DisplayText));
    }
}
