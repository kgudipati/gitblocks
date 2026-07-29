# Public V1 live completion

This is the compact reviewed completion artifact for the first full live
ingestion of `public-v1` and its immediate idempotency run. The source receipts
remained untracked and were removed with the ephemeral run directory after
review. This report contains only bounded receipt fields and normalized
persisted evidence; it contains no credential, provider response body, raw
header, telemetry stream, provider cache, or database content.

## Reviewed target

- Corrected implementation head before this report:
  `4f1d1f7873f2af29123e66736c22378ccc40cd4d`
- Catalog version: `public-v1`
- Profile rules: `public-profile-rules/1.0.0`
- Repositories and candidate-family profiles: 150
- Primary family distribution: 30 authorization, 30 audit logging, 30
  background jobs, 30 rate limiting, and 30 webhooks
- Manifest digest:
  `4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634`
- Database: dedicated PostgreSQL 18.4 test database on loopback, schema
  migration version 2, non-owner/non-superuser runtime login
- Container image:
  `postgres:18.4-bookworm@sha256:1961f96e6029a02c3812d7cb329a3b03a3ac2bb067058dec17b0f5596aca9296`
- Storage: container tmpfs, no bind mount or Docker volume
- Candidate concurrency: 1

## First run

- Source receipt path:
  `/var/folders/n7/_0tcz5z56z9cwcyxggg0df_40000gn/T/gitblocks-phase5-reviewed.zb68mo/first-reviewed-receipt.json`
  (untracked and removed after review)
- Started: `2026-07-29T18:36:52.773Z`
- Completed: `2026-07-29T18:41:55.393Z`
- Receipt digest:
  `b789167c49000f08fd7c1297e77ccca45a5ee112b193cfa2851d47ff6be63992`
- Requested / completed / candidate-family profiles: 150 / 150 / 150
- Created / updated / unchanged / partial / failed: 150 / 0 / 0 / 0 / 0
- Candidate records created / idempotent: 150 / 0
- Evidence created / idempotent: 1,244 / 0
- Snapshots created / idempotent: 150 / 0
- Supersessions / invalidations: 0 / 0
- Limitations / unknowns: 57 / 371
- Provider requests: 769 GitHub and 80 npm; 849 total
- Final GitHub primary limit: 5,000 limit, 4,582 remaining, reset at
  `2026-07-29T18:50:25Z`

The closed receipt parsed successfully, its digest validated, all 150 candidate
entries were unique, every snapshot ID was non-null, and the catalog, profile
rules, and migration versions matched the committed artifacts.

## Immediate second run

- Source receipt path:
  `/var/folders/n7/_0tcz5z56z9cwcyxggg0df_40000gn/T/gitblocks-phase5-reviewed.zb68mo/second-reviewed-receipt.json`
  (untracked and removed after review)
- Started: `2026-07-29T18:42:57.996Z`
- Completed: `2026-07-29T18:47:57.629Z`
- Receipt digest:
  `9dc7659dd4aea3e5abd22bfa1e6c58377b742b61fc0e7eccd31c8ee6bc919097`
- Requested / completed / candidate-family profiles: 150 / 150 / 150
- Created / updated / unchanged / partial / failed: 0 / 1 / 149 / 0 / 0
- Candidate records created / idempotent: 0 / 150
- Evidence created / idempotent: 1 / 1,243
- Snapshots created / idempotent: 1 / 149
- Supersessions / invalidations: 1 / 0
- Identical snapshots: 149
- New evidence: 1
- Provider requests: 769 GitHub and 80 npm; 849 total
- Final GitHub primary limit: 5,000 limit, 4,393 remaining, reset at
  `2026-07-29T18:50:25Z`

The closed receipt parsed successfully, its digest and comparison to the first
receipt validated, all snapshot IDs were non-null, and there were no duplicate
immutable evidence or lifecycle identifiers. The final database contained
1,245 distinct evidence records, 151 distinct historical snapshots for 150
candidate-family profiles, one distinct supersession, and no invalidations.

## Reviewed between-run change

`audit-signoz` was the only updated candidate. Its exact normalized
`repository-head` evidence changed while the two runs were in progress:

- old commit:
  `5eb3b5e3e0d61d359f0bec18d7dda723628f0833`, published
  `2026-07-29T18:22:27Z`;
- new commit:
  `7eb3f7df329453d13b5ca227c9823b59ba552a6c`, published
  `2026-07-29T18:24:30Z`; and
- lifecycle reason: `source-fact-changed`.

Both normalized immutable URLs identify commits in `SigNoz/signoz`. The
monotonic provider timestamps, exact commit identities, one appended evidence
record, one supersession, preserved historical snapshot, and new complete
snapshot establish a legitimate source change rather than an idempotency
failure.

## Boundary review

All 150 candidates produced complete snapshots. No candidate was partial or
failed. No candidate repository was cloned and no candidate package or code was
downloaded, installed, imported, built, tested, or executed. Gold remains
proposed/not-reviewed and evaluation scoring is unchanged. No ranking, model,
MCP, queue, daemon, scheduler, deployment, private-repository, tenant, or
additional production-package component was introduced.
