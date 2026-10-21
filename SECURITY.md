# Security

## Reporting a vulnerability

Do not publish credentials, private messages or working exploit details in public
issues. If GitHub offers **Security → Report a vulnerability** for this repository,
use that [private reporting form](https://github.com/unfortunately1337/Eclipse-Messenger/security/advisories/new).

If private reporting is unavailable, open a public issue titled **Request a private
security contact** containing only that request. Wait for the maintainer to provide
a private channel before sending details. No response-time guarantee is offered.

Include the affected commit, a minimal reproduction using accounts you control,
expected impact, and any proposed fix. Do not access other people's data or test
against `eclpse.ru` without the operator's explicit permission. Run tests locally.

## Scope and security claims

Publishing source code makes review possible; it is not an independent security
audit or a guarantee of confidentiality. This repository has no independent audit
report attached to this release.

Eclipse includes client encryption/key-handling flows, server-encrypted storage,
managed key backup/recovery, media encryption and a separate secret-chat lifecycle.
These modes have different trust and recovery properties. Do not assume public
channels, normal chats and secret chats have identical confidentiality guarantees,
or that the server cannot access any recovery material. Review the actual code and
deployment configuration against your threat model.

## Operating your own instance

- Generate independent values for every secret in `.env.example`.
- Use HTTPS, trusted reverse-proxy headers, restricted database/Redis access and
  private object storage. Local Compose passwords are development examples only.
- Back up database, media and long-lived encryption keys together. Rotating an
  encryption key without migrating existing data can make it unreadable.
- Keep `.env`, database exports, key material, sessions and user uploads out of Git.
- Apply Prisma migrations before serving traffic; `npm start` does this in `prestart`.
- Follow dependency advisories and review updates. Passing tests is not an audit.

## Dependency caveat

The development toolchain includes `braces@3.0.3`, which has a published nesting
denial-of-service advisory. The install script applies a bounded-nesting mitigation
and aborts if the expected parser changes. `npm audit` may continue to report the
upstream version; the local patch does not change its package metadata. Review
`scripts/patch-braces.cjs` and GHSA-vfj7-8cjw-p6xm. This is a mitigation, not a claim
that the upstream advisory has disappeared.
