# Repository interview pre-live verification

This directory is the content-free, offline verification authority for Phase 7
Milestone 10. It commits three candidate plans, two dated model profiles, the
readiness policy, the reproducible offline report, and a manifest binding those
files. It does not contain a materialized operator selection.

`catalog/public-v1/artifact-manifest.json` declares which public artifacts a
collector should request. It is not an inventory of materialized artifact sets
and cannot determine an artifact-set ID or identity digest. The Phase 6 raw
receipts and ephemeral database were intentionally not committed, so no
historical materialized inventory can be reconstructed from Git and none is
invented here.

Before calibration, a separately authorized fresh artifact collection must run
in the exact future ephemeral PostgreSQL database. The future materialization
command must join that run's complete raw receipt to the receipt-named sets
loaded from that same database. The generated selection and its materialization
binding remain untracked runtime authorities. The strict pre-live receipt
boundary requires the receipt itself to record migration `0004`. Generic
ingestion parsing continues to accept valid historical migration-`0003`
Phase 6 receipts, but those receipts are not Phase 7 materialization authority.
The live artifact operator now requires exact migration `0004` for every new
collection intended for this boundary. The prior preparation attempt correctly
stopped before database creation or collection when it exposed the stale
migration-`0003` live guard. After that correction was accepted, the next
preparation preflight correctly stopped again because a fresh migration-`0004`
database needs the exact durable catalog identities required by artifact
provenance and no catalog-only composition existed. The correction adds the
separate `catalog:seed` boundary, which writes only exact catalog candidates and
capability-family assignments after migration verification. It performs no
provider collection, profiling, evidence/dossier persistence, artifact or
interview publication, and no real preparation database or seed was run while
implementing it. Collection and materialization remain pending renewed review;
Milestone 11 remains blocked.

The two profiles are calibration candidates only. Neither is selected or Gate
A approved. Explicit `promptCacheRetention: "in-memory"` records request
intent; together with `store: false` it does not prove Zero Data Retention.
Retention and current pricing authorities remain external and unresolved, and
no real pre-live authorization is committed. Every pre-live CLI path,
including plan-only dry-run, authenticates the complete profile against one of
the two committed profile digests and bytes before policy or budget acceptance.

The committed authority digests are:

- candidate-plan schema:
  `f50d4b73c2fc04f0c13b7b1288a215ecc4a740fc2e97433478e3ffcdbe352387`;
- calibration plan:
  `35ad2ec35dc8424aeaa20d3ae065ba3dea73cdff9dce7d2dd4a5962d1974d54a`;
- Gate A membership plan:
  `f4459ed13522c912b4614ee612f39552e5957cde6dcadca15392690b40b0cead`;
- complete catalog plan:
  `a423f34c58f5def2a38029fe69918c4e8235d0bedd7c537aa65a2abe0fcf45ff`;
- `gpt-5.4-2026-03-05` profile:
  `a9345d998c12079b3b6beacf60869867ddaf97a8ba449b0b0f42f98e51ff005c`;
- `gpt-5.4-mini-2026-03-17` profile:
  `7cc772a1641c2068253486a5bf5773ac29c28e78a39f24851283d9d69dc378f3`;
- selection-materialization schema:
  `1c2ef4968c9de9d8d0c34c74350fc418d2ce1407a2ead62bb58eb33b682d0fe2`;
- pre-live-authorization schema:
  `e55b4d7a64fae07fa7f9f93ce4271993170c1ebf61d0246654227c4055cd4c76`;
- readiness policy:
  `19e3bfbd3bca28cd0b69154d801fb7744631a2cba327b62f5e0c7ce2cb2d49ab`;
- offline report:
  `163bd54ea05af7f07a337ac8db402507a4d9543c58dce5875a9a587c5ac38c7b`;
- pre-live manifest:
  `c967ed61e4b52b0094910f482d2b826a6d6ecf7e03a1705d63e6f3198130a960`.

Only `offline-verification` is satisfied. Fresh artifact materialization,
retention authority, pricing authority, model calibration, maintainer live
authorization, ephemeral database, provider credential, and audit assignment
readiness are unsatisfied. Consequently `liveReady` is false and calibration,
Gate A, and Gate B are blocked.

Readiness-policy `1.0.0` treats `model-calibration` as the result of
calibration, not a prerequisite to attempt it. Calibration becomes `ready`
only when the other eight exact prerequisites are `satisfied`;
`not-applicable` is not sufficient. In this calibration-only policy,
`liveReady` means only that exact calibration is eligible. Gate A and Gate B
remain unconditionally blocked even after calibration eligibility or a
satisfied model-calibration result; it does not express production or general
provider readiness.

Use `pnpm interviews:prelive:validate` for read-only byte and authority
validation. Use `pnpm interviews:prelive:verify` for the complete offline and
synthetic PostgreSQL proof. `pnpm interviews:prelive:materialize` is reserved
for a separately authorized future fresh receipt and exact ephemeral database;
ordinary verification never invokes it with real inputs.
