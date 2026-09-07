# overmind
Sistrategia's overmind

Backend tests run with .NET 8 and a dedicated SQL Server test instance. Start with the
[testing handoff](docs/testing-handoff.md) for restore/build/test commands, both RCSI profiles,
coverage and verification evidence, and CI/Kudu examples.

The [contact HTTP guide](docs/contact-http-api.md) documents the authenticated detail/edit/history API,
required issuer configuration, signed tenant/actor grants and atomic Save payloads. Token issuance and
administrative provisioning remain separate. Development schema endpoints are disabled by default and
require their own maintenance grant when explicitly enabled.
