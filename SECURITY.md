# GitBlocks security policy

## Current support status

GitBlocks has no released application, service, package, or supported production
version yet. Security reports about this repository's documentation, planned
design, repository workflow, or exposed credentials are still welcome.
The repository is currently private. Supported-version details and a verified
public reporting channel will be added before the first release.

## Report a vulnerability privately

While GitBlocks remains private, an authorized collaborator should contact the
repository owner through the existing private channel by which repository
access or project communication was established.

The initial message must not contain exploit details, secrets, proprietary
source, personal data, credentials, tokens, private keys, `.env` values, live
customer data, or sensitive payloads. A maintainer must confirm a secure,
least-privilege channel before detailed evidence is exchanged.

After that confirmation, use minimal redacted evidence and an encrypted or
access-controlled exchange appropriate to the report. Never test against
systems or data you do not own or have explicit authorization to assess.

## Public reporting readiness

Before GitBlocks becomes public or has a public release, maintainers must
configure and verify one of these reporting paths:

- GitHub private vulnerability reporting after the repository is public; or
- a dedicated security contact channel.

This configuration and end-to-end verification is release-blocking follow-up
work. It is not complete today, and this policy does not claim that an
unverified reporting mechanism exists.

## What to include

- affected document, component, version/commit, or planned boundary;
- vulnerability class and security impact;
- prerequisites and the smallest safe reproduction;
- whether exploitation could expose secrets, cross tenants, execute code,
  bypass approval/authorization, modify external state, or cause data loss;
- redacted logs or proof that do not contain sensitive payloads;
- suggested mitigation, if known; and
- a safe way to coordinate follow-up.

Do not run ingested or third-party proof-of-concept code in a privileged
environment. A report may describe a prompt-injection payload as quoted
untrusted data, but reviewers must not follow its instructions.

## Response process

Maintainers aim to acknowledge a complete private report within three business
days. Triage, remediation, and disclosure timing depend on severity,
reproducibility, affected users, and coordination needs. The reporter and
maintainers should agree on disclosure before publishing exploit details.

Maintainers will contain exposed credentials or data first, validate the issue
in an isolated and authorized environment, assess affected versions and users,
fix the root cause with regression/abuse evidence, and communicate remediation
through the private report. Credible authentication bypass, tenant escape,
remote execution, secret exposure, unapproved destructive action, or data loss
receives immediate priority.

The detailed engineering response and exception rules are in the
[security baseline](docs/engineering/security-baseline.md#vulnerability-handling).

## Public issues

Public issues may discuss already-disclosed, non-sensitive hardening ideas.
They must not contain an unpublished exploit path, secret, credential,
production identifier, proprietary source excerpt, unredacted log, or personal
data. If uncertain, report privately.
