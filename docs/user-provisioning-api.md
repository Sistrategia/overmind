# Administrative user provisioning

Iteration 6 creates a person/account or promotes an existing person, including a local password and
optional initial role. Read [ADR 0016](adr/0016-tenant-logins-and-administrative-provisioning.md) for the
precise database, authorization, password and transaction contracts.

## Configure and authorize

Use the [contact host configuration](contact-http-api.md#configure-the-host): trusted HTTPS authority,
exact issuer/audience, and a connection to the intended database. Assign the trusted application's
database principal to `provisioning_runtime`; ordinary `contact_runtime` does not expose account
construction. Role membership is deployment-owned and survives schema recreation.

The validated token must carry exactly one `overmind_actor` and `overmind_tenant` database public key.
Add these signed capabilities as appropriate:

| Claim | Example value | Meaning |
| --- | --- | --- |
| `overmind_provision` | `*` or a contact public-key GUID | Provision within the signed tenant, or only that contact. |
| `overmind_assign_role` | `12` | Assign that exact local role ID; repeat the claim for additional permitted IDs. |
| `overmind_contact` | `create:*` | Required when creating the new person. |
| `overmind_contact` | `edit:*` or `edit:{contactGuid}` | Required when supplying initial or promotion contact commands. |

Provisioning does not grant role-assignment authority automatically. No role wildcard exists. SQL
independently checks the chosen role belongs to the account's tenant or is global. The issuer must map
these local role IDs to the correct database/audience. The administrator's existing SQL role membership
is not automatically converted to a JWT grant. No actor or tenant fields belong in request JSON.

## Create a person and account

POST `/api/users`, Authorization: Bearer token, Content-Type: application/json:

```json
{
  "profile": {
    "contactTypeId": 1,
    "fullName": "Ernesto Ocampo",
    "personFirstName": "Ernesto",
    "personLastName1": "Ocampo"
  },
  "account": {
    "loginName": "Ernesto@example.test",
    "password": "<supply a private initial passphrase>",
    "accountEmail": "ernesto@example.test",
    "initialRoleId": 12
  },
  "commands": [
    { "kind": "email.insert", "value": "ernesto@example.test", "location": "Work" },
    { "kind": "phone.insert", "value": { "number": "+527773123456" } },
    { "kind": "web_link.insert", "value": { "url": "https://example.test" } },
    { "kind": "address.insert", "value": { "address1": "Office", "country": "México" } }
  ]
}
```

The password above is a placeholder, not a credential to reuse. Select a role ID that exists and that
the token authorizes, or omit initialRoleId. AccountEmail and commands may also be omitted. Login and
account email do not implicitly add contact email; the example supplies it as an explicit command.
AccountEmail remains unconfirmed.

Creation returns 201 and Location `/api/contacts/{publicKey}`. The receipt has publicKey, userId,
entityVersion 1, dbrowVersion as a decimal string, loginName, accountEmail, initialRoleId and childIdentities
indexed by commandIndex. Contact-detail reads still require their own read permission. No password/hash
is returned. An optional top-level publicKey requests a particular new identity; it is not an upsert.

## Promote an existing person

POST `/api/users/{contactPublicKey}/promote`:

```json
{
  "expectedEntityVersion": 2,
  "account": {
    "loginName": "Ernesto@example.test",
    "password": "<supply a private initial passphrase>"
  },
  "commands": [
    {
      "kind": "phone.replace",
      "ordinal": 1,
      "value": { "number": "+527773123456" },
      "extension": "25"
    }
  ]
}
```

Promotion returns 200 with the final receipt. In this example, both the phone change and account
promotion commit at revision 3; there is no intermediate committed revision. Commands may be omitted
to preserve every contact field. Explicit profile.replace follows the existing full-replacement rules;
omitted optional profile fields clear. Commands execute in listed order before account creation. A late
duplicate login or rejected role rolls back all preceding changes.

The person must exist, be active and eligible, and match expectedEntityVersion. Organizations/groups
cannot receive ordinary accounts or be converted to people through this API. Already-provisioned roots
conflict. Account promotion accepts profile/channel changes but excludes contact.delete/contact.restore.
Complete any needed authorized root restoration in a separate contact operation first.

## Login and password rules

Logins are **case-insensitive within one tenant**, with original spelling preserved. Separate tenants
may use the same login. They are generally emails; compatible non-email aliases remain allowed. No
whitespace trimming, dot removal, `+tag` removal or mailbox-provider rewriting occurs. Accents remain
significant. The fixed SQL comparison and exact rejected whitespace/control ranges are documented in
ADR 0016. Login length is 1–256 UTF-16 code units.

Password length is 15–128 UTF-16 code units; an entirely whitespace value rejects. Spaces otherwise
remain meaningful. Passwords are case-sensitive inputs and are never normalized like logins. The service
uses Identity V3 salted PBKDF2-HMAC-SHA512, 220,000 iterations, before opening the write transaction.
The database stores only the standard password hash; the framework includes its salt and work factor.

The administrator supplies and hands off the initial password through the application's chosen channel.
This iteration does not send invitations, generate passwords or require a first-login password change.
Use HTTPS and keep request bodies out of deployment logs. The API has no password retrieval endpoint.

## Results and next work

Both endpoints use strict camelCase JSON, reject duplicate/unknown fields, limit bodies to 1 MiB/depth
32, and accept up to 256 contact commands. PasswordHash, passwordSalt, actor and tenant are not client
fields. Development Swagger marks password write-only and lists all 21 permitted contact commands.

401 means authentication failed; 403 means a required grant or SQL actor check failed. Missing or
wrong-tenant contacts return 404. Invalid inputs, role definitions or person categories return 400.
Duplicate logins, stale revisions and competing/already-completed promotion return 409/conflict.
500/commit_uncertain means acknowledgement was uncertain; do not blindly replay. Responses contain
`automaticRetryAllowed: false`, omit internal exception text and use Cache-Control: no-store.

Local password setup is complete for these account-construction operations. **Login/token issuance is
still separate.** A later login operation must resolve tenant before looking up the account and verify
the stored Identity hash; the configured external JWT issuer does not automatically use this database's
passwords. Invitation/reset delivery, ongoing credential changes, lockout/rate limits, compromised-password
screening, account email/phone verification, shared-user membership and complete role lifecycle need
their own implementation. Account history/event evidence exists; no full account-history HTTP reader is
claimed. See the [test record](testing-handoff.md#iteration-6-administrative-provisioning--2026-09-07).
