# Outcome baseline v1

Reproduce from the repository root with `pnpm outcome:baseline:v1`.

This report contains no request prose, candidate display names, or model output text.

## Aggregate outcome counts

| Outcome                | Count |
| ---------------------- | ----: |
| clarification-required |     0 |
| unsupported            |     0 |
| insufficient-evidence  |     3 |
| no-viable-candidate    |     0 |
| recommend              |    11 |
| failed                 |     1 |

## Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     1 |                   0 |         2 |      0 |
| audit-logging     |                      0 |           0 |                     2 |                   0 |         1 |      0 |
| background-jobs   |                      0 |           0 |                     0 |                   0 |         3 |      0 |
| rate-limiting     |                      0 |           0 |                     0 |                   0 |         3 |      0 |
| webhooks          |                      0 |           0 |                     0 |                   0 |         2 |      1 |

## Non-recommend outcomes

| Fixture                               | Outcome               | Producing stage                     | Reason                               |
| ------------------------------------- | --------------------- | ----------------------------------- | ------------------------------------ |
| authorization-next-selfhosted-drizzle | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-next-vercel-drizzle     | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-next-selfhosted-drizzle | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| webhooks-next-selfhosted-drizzle      | failed                | deterministic assessment validation | invalid-target-fit-response          |

## Insufficient-evidence detail

| Fixture                               | Unresolved hard evaluations per finalist | Artifact excerpt available per finalist |
| ------------------------------------- | ---------------------------------------- | --------------------------------------- |
| authorization-next-selfhosted-drizzle | [4, 3, 3, 3, 4]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-next-vercel-drizzle     | [3, 3, 3, 3, 3]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-next-selfhosted-drizzle | [5, 5, 5, 5, 5]                          | [yes, yes, yes, yes, yes]               |

## Recommend detail

| Fixture                                        | Options returned | Eligible-lane options | Evidence-needed-lane options | Options with unverified constraints |
| ---------------------------------------------- | ---------------: | --------------------: | ---------------------------: | ----------------------------------: |
| authorization-next-vercel-drizzle              |                3 |                     0 |                            3 |                                   3 |
| authorization-express-container-prisma-redis   |                3 |                     0 |                            3 |                                   0 |
| audit-logging-express-container-prisma-redis   |                1 |                     0 |                            1 |                                   0 |
| background-jobs-next-vercel-drizzle            |                1 |                     0 |                            1 |                                   1 |
| background-jobs-express-container-prisma-redis |                2 |                     0 |                            2 |                                   0 |
| background-jobs-next-selfhosted-drizzle        |                1 |                     0 |                            1 |                                   1 |
| rate-limiting-next-vercel-drizzle              |                3 |                     0 |                            3 |                                   0 |
| rate-limiting-express-container-prisma-redis   |                2 |                     0 |                            2 |                                   0 |
| rate-limiting-next-selfhosted-drizzle          |                2 |                     0 |                            2 |                                   2 |
| webhooks-next-vercel-drizzle                   |                1 |                     0 |                            1 |                                   1 |
| webhooks-express-container-prisma-redis        |                2 |                     0 |                            2 |                                   0 |

### Recommended option detail

| Fixture                                        | Candidate ID                    | Lane            | Verification                     | Unverified constraints | Evidence references                                                                                                                                                                                                                                                                                                                                                                                                                  | Material unknowns                                                                                                                                                                                                                | Disposition |
| ---------------------------------------------- | ------------------------------- | --------------- | -------------------------------- | ---------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| authorization-next-vercel-drizzle              | auth-casbin-node-casbin         | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-1043e012fa62346177938ea4b1f627ecff67b28e, artifact-evidence-37a5d83a039e2b54ce89d28ce0092a0c8362fea2, ev-a1d189bf726d793724b034fd56f98dab56312038, artifact-evidence-3a7c582175d3307927f9ce8d8af8dcac9e356e7f]                                                                                                                                                                                                    | [assessment-unknown-5bd2183a54d63a0e92a699ce45590d102e9eab2208bce, assessment-unknown-359c44875b9ac79bfa38d16457990e9cd2dcfee7fe92e, assessment-unknown-ed82000bdb3e1bef6757156774aaf141059aab21e924e]                           | viable      |
| authorization-next-vercel-drizzle              | auth-casbin-casbin              | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-15de1d65cba130055ca4e3a3bcb541f99793cc97, artifact-evidence-c558152924def1d1797f369e610759da05fd34e9, artifact-evidence-6daafdac6c2eecbbc33249f1d440ba9e333a510c, ev-c3bb8ffe2606edb7ef5c0f6c8bb6ab748351d65f, artifact-evidence-05159ffc0466aa4b7a5c8dd400b1cae2d726057c]                                                                                                                                        | [assessment-unknown-61023fb85f472e180b12462c0061002a6701f194babe0, assessment-unknown-d62c6413d1ffaab0847f994afbe226935d6afc85b1d8f]                                                                                             | viable      |
| authorization-next-vercel-drizzle              | auth-casbin-casbin-js           | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-2e07e70680280f50531209d25a663a57c20678bf, artifact-evidence-f24f6304538f657127d9c525698d485a38c937df, ev-20fffa0efde9b27f20d7fc34c87a634799f60980]                                                                                                                                                                                                                                                                | [assessment-unknown-32b7705536f2150ad2f3369404a24cb56d82e55808fb1, assessment-unknown-cbb929e1553dd1120f20e9e73a5616bb853696117a6fa, assessment-unknown-d1d3fd7fa4447704d7e9faf20af6fa4b33f0e4dffceed]                           | viable      |
| authorization-express-container-prisma-redis   | auth-casbin-node-casbin         | evidence-needed | fully-verified                   |                      0 | [ev-9fbd68343089b0eb99e551fec718aedac9d8d5f7, artifact-evidence-1043e012fa62346177938ea4b1f627ecff67b28e, artifact-evidence-37a5d83a039e2b54ce89d28ce0092a0c8362fea2, ev-a1d189bf726d793724b034fd56f98dab56312038]                                                                                                                                                                                                                   | [unk-8538c6db70ce6362931c72431ccbfe42c9bf77f7, assessment-unknown-1d604f43e0c5814708b2e60b3c258f21d8ee644db2492]                                                                                                                 | recommended |
| authorization-express-container-prisma-redis   | auth-casbin-casbin              | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-15de1d65cba130055ca4e3a3bcb541f99793cc97, artifact-evidence-c558152924def1d1797f369e610759da05fd34e9, ev-c3bb8ffe2606edb7ef5c0f6c8bb6ab748351d65f]                                                                                                                                                                                                                                                                | [unk-acb2a8b67b802d4a3290bb0e0c7e0b5c3361201e, assessment-unknown-4136a66f6138f0b5d8f5ae42b29e7739389fb6bfb8cc9]                                                                                                                 | viable      |
| authorization-express-container-prisma-redis   | auth-casbin-casbin-js           | evidence-needed | fully-verified                   |                      0 | [ev-cd82e507ca536887819663632baa5fc3c7593e3d, artifact-evidence-2e07e70680280f50531209d25a663a57c20678bf, artifact-evidence-f24f6304538f657127d9c525698d485a38c937df, ev-20fffa0efde9b27f20d7fc34c87a634799f60980]                                                                                                                                                                                                                   | [unk-2c2b6c80edfb2e5ce987787c768f514f16313672, assessment-unknown-377228945d54c61aec253e74e00cc5a84648695623828]                                                                                                                 | viable      |
| audit-logging-express-container-prisma-redis   | audit-roarr                     | evidence-needed | fully-verified                   |                      0 | [ev-e281aa00f5e9ac8db0ddf7d62bc8dacd2dd3bd60, artifact-evidence-15efffefabaa1e3387218002daa8e9a0ea911119, artifact-evidence-83f13510eb1011d211d01ab996dcfd68c9b513ca]                                                                                                                                                                                                                                                                | [unk-96429b1f165a68a1b782b26d115e499777ee69b3, assessment-unknown-ec37ff5c6569468ee010e531c05b6ded9ff2769e6b1d7, assessment-unknown-9bc62760d1811468641d45c5a42d9c5b352b1ac0e9d4e]                                               | recommended |
| background-jobs-next-vercel-drizzle            | jobs-agenda                     | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-56554adc9e54719c94ff48de3f5fa8ca9005b9ba, artifact-evidence-312be5ce4f6724e6dba8e0eef207b994af4a1e18, artifact-evidence-e35b1a3d47dce5e5a6c31eb5175f29f1befcd3c0, artifact-evidence-94e397c1e6fed20a15c05248e890fa296f1dd79c, artifact-evidence-566537718b516b3fa460a0cdd7e810983ee14133, artifact-evidence-b43c38328463e9621c6a7015b88949c5d9776b4b]                                                             | [assessment-unknown-49999e023467f265a7615c74da9eea0ec52c7c2799390]                                                                                                                                                               | recommended |
| background-jobs-express-container-prisma-redis | jobs-agenda                     | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-56554adc9e54719c94ff48de3f5fa8ca9005b9ba, artifact-evidence-312be5ce4f6724e6dba8e0eef207b994af4a1e18, artifact-evidence-e35b1a3d47dce5e5a6c31eb5175f29f1befcd3c0, artifact-evidence-94e397c1e6fed20a15c05248e890fa296f1dd79c]                                                                                                                                                                                     | [assessment-unknown-cd99a62f9f5081342c23d845378c9743744c5b4bbcaa0]                                                                                                                                                               | viable      |
| background-jobs-express-container-prisma-redis | jobs-rq                         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-e94f2ecd5662420a9bee767afa09ea7a9365db23, artifact-evidence-3d669caa8c14f65cf4de8edbb94d2ab402d79c2c, artifact-evidence-43a17273a70e61df6f92d0452c3064762ba72a46]                                                                                                                                                                                                                                                 | [assessment-unknown-fc5d96059a619106e79152417c2af7e23bd17815f8c61]                                                                                                                                                               | viable      |
| background-jobs-next-selfhosted-drizzle        | jobs-agenda                     | evidence-needed | unverified-prohibited-constraint |                      3 | [artifact-evidence-56554adc9e54719c94ff48de3f5fa8ca9005b9ba, artifact-evidence-312be5ce4f6724e6dba8e0eef207b994af4a1e18, artifact-evidence-e35b1a3d47dce5e5a6c31eb5175f29f1befcd3c0, artifact-evidence-94e397c1e6fed20a15c05248e890fa296f1dd79c, artifact-evidence-2aa9d210a813b05129b45ae90e64743bb3d780ce, artifact-evidence-566537718b516b3fa460a0cdd7e810983ee14133, artifact-evidence-b43c38328463e9621c6a7015b88949c5d9776b4b] | [unk-7c270317506bc956f2a2daf3ccee17d9de2e13d4, assessment-unknown-7ca17381b2fb38c38f1262d739c2e52cc250132576cc4, assessment-unknown-85329992782c8f8733850a4e9f2e80c3e30db3d4fa926]                                               | viable      |
| rate-limiting-next-vercel-drizzle              | rate-express-rate-limit         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-8225fbdbff1a96c6fd1dfe53f996c16e53b0ec58, artifact-evidence-7f0fea9b28d7b7c49911ef9f599f00d0a3fb0f49]                                                                                                                                                                                                                                                                                                             | [assessment-unknown-7c0c8b789cb59ea920cbef034b614ea3d02cb3d75b2bf, assessment-unknown-3fadb7f6679df2fe829bd91f6d20cf4d0a28cce1425d5]                                                                                             | recommended |
| rate-limiting-next-vercel-drizzle              | rate-fastify-rate-limit         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-5f3e183b5a6498a5891ed8368e61163754f003b6, artifact-evidence-0550fa0163cd72ff7a0bc94b7b98119054f64cef]                                                                                                                                                                                                                                                                                                             | [assessment-unknown-5be779f5bd58047dd01f665195a9f87fc35837cba6624, assessment-unknown-2467343107db768627e2382b949b111a7a0e4cc65fced]                                                                                             | viable      |
| rate-limiting-next-vercel-drizzle              | rate-node-rate-limiter-flexible | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf, artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f]                                                                                                                                                                                                                                                                                                             | [assessment-unknown-2f319fa580deb5e57c3b182d4939d5d5ef09e924675d2, assessment-unknown-0dd3800f1524b6737eb420e655aa7b1955259c97f5883]                                                                                             | viable      |
| rate-limiting-express-container-prisma-redis   | rate-express-rate-limit         | evidence-needed | fully-verified                   |                      0 | [ev-8e72a255108bece4e257d4f773ea8b1d3beaffd3, artifact-evidence-8225fbdbff1a96c6fd1dfe53f996c16e53b0ec58, artifact-evidence-7f0fea9b28d7b7c49911ef9f599f00d0a3fb0f49]                                                                                                                                                                                                                                                                | [assessment-unknown-f8189be286b8eb1a66cae75ea178b2fb278481eaba01c]                                                                                                                                                               | viable      |
| rate-limiting-express-container-prisma-redis   | rate-node-rate-limiter-flexible | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf, artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f]                                                                                                                                                                                                                                                                                                             | [assessment-unknown-d4d3fd5bafd2e9a7300516a099c348f034f2bfae79589]                                                                                                                                                               | viable      |
| rate-limiting-next-selfhosted-drizzle          | rate-node-rate-limiter-flexible | evidence-needed | unverified-prohibited-constraint |                      2 | [artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf, artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f, ev-7ad2a98d02e2d3b3985452cfb0ba2cee08f891c2]                                                                                                                                                                                                                                                                | [unk-99493d5e13f3af0e2719524aafafe3e0368f118c, unk-a032f5e645a9e2a2168b4eb254e9f8897fd21ce1, assessment-unknown-ea6db959a073978ff52c18c7193b80328205dca3fd634, assessment-unknown-e7a3138bdb573a9450e4da9e1b58f52100800462e2785] | viable      |
| rate-limiting-next-selfhosted-drizzle          | rate-express-rate-limit         | evidence-needed | unverified-prohibited-constraint |                      2 | [artifact-evidence-8225fbdbff1a96c6fd1dfe53f996c16e53b0ec58, artifact-evidence-7f0fea9b28d7b7c49911ef9f599f00d0a3fb0f49, artifact-evidence-edec3e57ac3534601dbc154c0cf222312c8b8092, ev-8e72a255108bece4e257d4f773ea8b1d3beaffd3, artifact-evidence-9972b016d0709294abf6cd2960a629ed55eb791d]                                                                                                                                        | [unk-70b920f4c31daf52dca790a9d2ee57d5e054c96c, assessment-unknown-76dd93510ebca5ac46b21897f7a458063c381b88f6b9d, assessment-unknown-1a57841f18a70a3d68a40f7c1c014405182d5885a0d15]                                               | viable      |
| webhooks-next-vercel-drizzle                   | webhook-standard-webhooks       | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-b4696e47dcc0d5627df6c1762a7699319615a601, artifact-evidence-e37bdb1fdb927a8762567a7d314d7c6181a1fc63, artifact-evidence-3dc02ec99ec26d56034d111ef3a1d4d73b1c997c, artifact-evidence-1b52cd51778fa33e92a715f9f588b8830fc94031, artifact-evidence-6db70c09a00e8d4ba3811dd408bcca617d2264fa, ev-a6bfff68d12935a8f8f1c5579b638f63b72ac400]                                                                            | [unk-6aaec47758d76c5f40c7d135da75c7e56edd72e2, assessment-unknown-ac4fda05fdb1838cd366e403addc367c74617d9b4b372]                                                                                                                 | recommended |
| webhooks-express-container-prisma-redis        | webhook-svix                    | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-4e97f0e405f925595fd96f7c2201c78a7014d5ff, artifact-evidence-d5e2cd094b67c01dd3c19b54e89f31d60751abda, ev-40f7f3a9aad23b56dbc916d0dea2a4aa7932c9bb, artifact-evidence-721b0a360d115f71c971f67d87245154b15a0329]                                                                                                                                                                                                    | [unk-88ed064aeaaa32dffb33cb8f026a5f6889c0d854, assessment-unknown-f7535c53af755ca2409bcf9cd19511ad0dfd8dc34c127]                                                                                                                 | recommended |
| webhooks-express-container-prisma-redis        | webhook-adnanh                  | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-9f1184779a8966ef4f99d85ccd16cf71cdc4ec13, artifact-evidence-c7ac0cbedef93bf65380934970e847f41718353e, artifact-evidence-204191e0bf025ba7210d1d52af8d63b1bd4c2217]                                                                                                                                                                                                                                                 | [unk-5537a25a75980ae8b6cf91744c32b1e6fd3807b0, assessment-unknown-d171bf54f69cdd124eda7b002f64a8357ca7275fba7e7]                                                                                                                 | recommended |

## Model calls

Total model calls made: 15.

Completed model calls: 15.

Deterministically valid responses: 14.

Median completed-call latency: 26959.5 ms.

Maximum completed-call latency: 35567.8 ms.

Median output tokens: 3143.0.

## Assessment diagnostics

Model responses captured for diagnostics: 15 of 15 fixtures.

Harness canonical validations passed: 14.

Diagnostic capture failures: 0.

Unknown totals include supplied candidate unknowns plus model-declared assessment unknowns; limitation totals are the supplied candidate limitation catalog hydrated by validation.

### Domain issue categories

| Category                  | Calls | Occurrences |
| ------------------------- | ----: | ----------: |
| domain.claim.traceability |     1 |           1 |

### Disposition totals

| Disposition           | Count |
| --------------------- | ----: |
| recommended           |     7 |
| viable                |    15 |
| rejected              |     2 |
| insufficient-evidence |    51 |

### Hard-resolution state totals

| State      | Count |
| ---------- | ----: |
| satisfied  |    57 |
| conflict   |     2 |
| unresolved |   151 |

### Declared catalog totals

| Catalog     | Count |
| ----------- | ----: |
| inferences  |   109 |
| claims      |    99 |
| unknowns    |   309 |
| limitations |     9 |
| conflicts   |     2 |

Fixtures with any satisfied hard resolution: 13.

Candidates with any satisfied hard resolution: 44.

Fixtures with a rejected disposition on a declared conflict: 2.

Candidates with a rejected disposition on a declared conflict: 2.

### Per-fixture diagnostic totals

| Fixture                                        | Response | Validation | Domain issues | Dispositions                                                 | Resolutions                            | Catalogs                                                          | Any satisfied | Rejected conflict |
| ---------------------------------------------- | -------- | ---------- | ------------: | ------------------------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------- | ------------- | ----------------- |
| authorization-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=7  | inferences=6, claims=6, unknowns=23, limitations=3, conflicts=0   | yes           | no                |
| authorization-express-container-prisma-redis   | captured | passed     |             0 | recommended=1, viable=2, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=2  | inferences=6, claims=6, unknowns=16, limitations=3, conflicts=0   | yes           | no                |
| authorization-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=3, conflict=0, unresolved=17 | inferences=8, claims=5, unknowns=22, limitations=3, conflicts=0   | yes           | no                |
| audit-logging-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=15 | inferences=0, claims=6, unknowns=22, limitations=0, conflicts=0   | no            | no                |
| audit-logging-express-container-prisma-redis   | captured | passed     |             0 | recommended=1, viable=0, rejected=0, insufficient-evidence=4 | satisfied=2, conflict=0, unresolved=8  | inferences=5, claims=6, unknowns=21, limitations=0, conflicts=0   | yes           | no                |
| audit-logging-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25 | inferences=0, claims=6, unknowns=20, limitations=0, conflicts=0   | no            | no                |
| background-jobs-next-vercel-drizzle            | captured | passed     |             0 | recommended=1, viable=0, rejected=0, insufficient-evidence=4 | satisfied=5, conflict=0, unresolved=10 | inferences=7, claims=8, unknowns=18, limitations=0, conflicts=0   | yes           | no                |
| background-jobs-express-container-prisma-redis | captured | passed     |             0 | recommended=0, viable=2, rejected=0, insufficient-evidence=3 | satisfied=6, conflict=0, unresolved=4  | inferences=12, claims=6, unknowns=17, limitations=0, conflicts=0  | yes           | no                |
| background-jobs-next-selfhosted-drizzle        | captured | passed     |             0 | recommended=0, viable=1, rejected=0, insufficient-evidence=4 | satisfied=6, conflict=0, unresolved=19 | inferences=9, claims=9, unknowns=24, limitations=0, conflicts=0   | yes           | no                |
| rate-limiting-next-vercel-drizzle              | captured | passed     |             0 | recommended=1, viable=2, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=2  | inferences=6, claims=3, unknowns=22, limitations=0, conflicts=0   | yes           | no                |
| rate-limiting-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=2, rejected=0, insufficient-evidence=3 | satisfied=3, conflict=0, unresolved=2  | inferences=7, claims=5, unknowns=20, limitations=0, conflicts=0   | yes           | no                |
| rate-limiting-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=2, rejected=0, insufficient-evidence=3 | satisfied=3, conflict=0, unresolved=12 | inferences=7, claims=5, unknowns=21, limitations=0, conflicts=0   | yes           | no                |
| webhooks-next-vercel-drizzle                   | captured | passed     |             0 | recommended=1, viable=0, rejected=1, insufficient-evidence=3 | satisfied=7, conflict=1, unresolved=7  | inferences=11, claims=8, unknowns=22, limitations=0, conflicts=1  | yes           | yes               |
| webhooks-express-container-prisma-redis        | captured | passed     |             0 | recommended=2, viable=0, rejected=0, insufficient-evidence=3 | satisfied=7, conflict=0, unresolved=3  | inferences=15, claims=8, unknowns=18, limitations=0, conflicts=0  | yes           | no                |
| webhooks-next-selfhosted-drizzle               | captured | failed     |             1 | recommended=0, viable=1, rejected=1, insufficient-evidence=3 | satisfied=6, conflict=1, unresolved=18 | inferences=10, claims=12, unknowns=23, limitations=0, conflicts=1 | yes           | yes               |

## Failure categories

| Category                    | Calls | Occurrences |
| --------------------------- | ----: | ----------: |
| invalid-target-fit-response |     1 |           1 |
