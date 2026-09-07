# ADR 0009: Phone values, parsing and numbering geography

Date: 2026-09-07. Status: implemented and verified for fresh schemas.

The author approved this direction after read-only intake of Mastio and CFUS-TOP-React.
Both retain useful split input but reuse values by local phone_number alone. Their Mexican
last-ten-digits parser and address-to-phone geographic copying are not migration contracts.

## Identity and input

The immutable phone dictionary identifies a complete E.164 number (plus followed by at most
15 ASCII digits). Country calling code and national significant number are strings; leading
zeros in the national number survive. Neither formatting, extension, geographic enrichment
nor parser version changes this identity. Calling codes are not country primary keys.

An immutable phone input/interpretation value preserves original input, explicit parsing
region and optional split input, normalized components, numbering region, optional area/local
decomposition, geographic description and parser metadata version. Associations reference that
value as well as the canonical phone. This permits two contacts to preserve different entered
spellings without changing a shared number. Interpretation changes use another value; old
history never acquires new labels from a later metadata release.

The backend parses with pinned libphonenumber-csharp metadata behind a small framework API.
Input without a leading plus requires an explicit ISO parsing region. Split area/local input
also requires that region. No default is inferred from address or tenant. Incomplete local
numbers, vanity/text extraction, embedded extensions, excess length and invalid ranges reject;
extension has its own field. No last-ten truncation or silent legacy +52-1 repair is performed.
Importing unresolved legacy values remains separate work. Validity is numbering-plan validity,
not proof of reachability, ownership or SMS capability.

SQL callers supply the normalized interpretation contract. SQL checks shape, lengths, ASCII
digits and component consistency; numbering-plan validation is the trusted backend's duty.
SQL does not host a second international parser. Constructors accept the same prepared value;
legacy ambiguous phone inputs reject with instructions to normalize first. The actual seed is
updated explicitly. Contact construction delegates to the same private phone writer at revision 1.

## Geography

Numbering geography is an inference, distinct from contact residence or business location.
Country/area segmentation may use parsed numbering metadata; unavailable or ambiguous areas
remain unknown. Area/local decomposition is optional and may be unavailable for mobile or
nongeographic numbers. Mexican historical LADA grouping is a presentation/segmentation hint,
not a guarantee of the subscriber's present city.

Versioned numbering-area catalog entries can map to multiple country/state/city records through
checked references. Catalog import is an administrative operation, not a phone writer privilege.
Do not manufacture catalog geography by splitting localized geocoder descriptions. Initial
parsing uses the bundled offline metadata and retains its description/version; authoritative
geographic-ID catalog population requires a separately sourced mapping dataset.

## Association semantics

Stable ordinal, saved dense order, immutable value references, label, extension (25 UTF-16
units), restrictive is_public default, tenant/version and retained identity follow email.
Duplicate base numbers are allowed as separate entries, supporting different extensions and
labels. Update/restore replace all association fields; NULL clears optional label/extension.
Exact repeated replacement is a no-op. Original spelling is audited, so a spelling-only change
is effective even when the canonical phone is unchanged. Restore is explicit and appends.

is_public expresses eligibility for directory display, subject to root privacy and application
authorization. Trusted internal readers return the flags and all authorized contact data;
this iteration creates no anonymous/public-directory endpoint. Contact phone never updates
account/recovery phone or confirmation state.

## Concrete storage decisions

`phone` holds typed E.164/calling-code/national columns. `phone_input` stores an exact immutable
JSON snapshot with persisted/indexed numbering-region and area projections. This keeps captured parser
metadata together while relational FKs govern canonical value and association identity. It is not
arbitrary JSON: SQL accepts only recognized unique properties with string/null values and checks lengths
and component consistency. Public C# state is typed. Canonical serialization is supplied by
`PhoneParser.PrepareForDatabase`; different raw JSON serializations remain different accepted input values.
Hash collisions only add locking/lookup work; full bytes plus length determine input reuse.

Contact/user constructors append @phone_data and widen phone label/extension parameters to NVARCHAR(MAX)
so the writer can reject oversize values rather than receive silently truncated data. Initial phones
reuse the creation unit with expected version 0, remain revision 1 and hide their action from the timeline
like initial email. Labels/extensions without prepared input also reject. Legacy split parameters are
retained in the signature for a clear error, not interpreted using address context. The seed explicitly
supplies normalized data tagged as an installation value. General unresolved-value import is not supplied.

The optional geographic catalog is created with checked place FKs but remains unpopulated. Its dataset
provenance must be established before geographic-ID enrichment. The bundled parser's country/area and
description already support qualified numbering segmentation; no city precision is invented.

## Sources and verification boundary

- [C# parser](https://github.com/twcclegg/libphonenumber-csharp) and
  [parsing/validity limitations](https://github.com/google/libphonenumber/blob/master/FAQ.md).
- [Mexico numbering-plan communication, pages 17–18](https://www.itu.int/dms_pub/itu-t/opb/sp/T-SP-OB.1297-2024-OAS-PDF-S.pdf)
  describes ten-digit national numbers and replacement of the former NIR allocation boundary.
- [Mexico prefix metadata](https://raw.githubusercontent.com/google/libphonenumber/master/resources/geocoding/en/52.txt)
  illustrates coarse/multiple-place mappings; 52777 is described as Morelos.

Final Release build/discovery and full gate passed 53/53, zero failures/skips or build warnings/errors,
5 min 30 sec, with both READ COMMITTED profiles (RCSI off/on). All 142 distinct disposable databases
across seven runs have verified removal evidence. The final run is under ignored
`artifacts/test-results/iteration-1/final/`; the [testing handoff](../testing-handoff.md#iteration-1-phone-and-composed-reader--2026-09-07)
records development corrections and coverage. No sibling project, populated customer schema,
import pipeline or HTTP boundary was changed.
