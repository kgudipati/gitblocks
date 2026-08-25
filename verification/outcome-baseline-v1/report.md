# Outcome baseline v1

Reproduce from the repository root with `pnpm outcome:baseline:v1`.

This report contains no request prose, candidate display names, or model output text.

## Aggregate outcome counts

| Outcome                | Count |
| ---------------------- | ----: |
| clarification-required |     0 |
| unsupported            |     0 |
| insufficient-evidence  |     2 |
| no-viable-candidate    |     0 |
| recommend              |    13 |
| failed                 |     0 |

## Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     0 |                   0 |         3 |      0 |
| audit-logging     |                      0 |           0 |                     1 |                   0 |         2 |      0 |
| background-jobs   |                      0 |           0 |                     0 |                   0 |         3 |      0 |
| rate-limiting     |                      0 |           0 |                     0 |                   0 |         3 |      0 |
| webhooks          |                      0 |           0 |                     1 |                   0 |         2 |      0 |

## Non-recommend outcomes

| Fixture                                      | Outcome               | Producing stage                     | Reason                               |
| -------------------------------------------- | --------------------- | ----------------------------------- | ------------------------------------ |
| audit-logging-express-container-prisma-redis | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| webhooks-next-selfhosted-drizzle             | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |

## Insufficient-evidence detail

| Fixture                                      | Unresolved hard evaluations per finalist | Artifact excerpt available per finalist |
| -------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| audit-logging-express-container-prisma-redis | [2, 2, 1, 1, 2]                          | [yes, yes, yes, yes, yes]               |
| webhooks-next-selfhosted-drizzle             | [4, 5, 3, 3, 2]                          | [yes, yes, yes, yes, yes]               |

## Recommend detail

| Fixture                                        | Options returned | Eligible-lane options | Evidence-needed-lane options | Options with unverified constraints |
| ---------------------------------------------- | ---------------: | --------------------: | ---------------------------: | ----------------------------------: |
| authorization-next-vercel-drizzle              |                3 |                     0 |                            3 |                                   3 |
| authorization-express-container-prisma-redis   |                1 |                     0 |                            1 |                                   0 |
| authorization-next-selfhosted-drizzle          |                2 |                     0 |                            2 |                                   2 |
| audit-logging-next-vercel-drizzle              |                1 |                     0 |                            1 |                                   1 |
| audit-logging-next-selfhosted-drizzle          |                1 |                     0 |                            1 |                                   1 |
| background-jobs-next-vercel-drizzle            |                1 |                     0 |                            1 |                                   1 |
| background-jobs-express-container-prisma-redis |                2 |                     0 |                            2 |                                   0 |
| background-jobs-next-selfhosted-drizzle        |                1 |                     0 |                            1 |                                   1 |
| rate-limiting-next-vercel-drizzle              |                3 |                     0 |                            3 |                                   0 |
| rate-limiting-express-container-prisma-redis   |                3 |                     0 |                            3 |                                   0 |
| rate-limiting-next-selfhosted-drizzle          |                3 |                     0 |                            3 |                                   3 |
| webhooks-next-vercel-drizzle                   |                1 |                     0 |                            1 |                                   1 |
| webhooks-express-container-prisma-redis        |                1 |                     0 |                            1 |                                   0 |

### Recommended option detail

| Fixture                                        | Candidate ID                    | Lane            | Verification                     | Unverified constraints | Evidence references                                                                                                                                                                                                                                                                                                                                                                                                                  | Material unknowns                                                                                                                                                                                                                                                              | Disposition |
| ---------------------------------------------- | ------------------------------- | --------------- | -------------------------------- | ---------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| authorization-next-vercel-drizzle              | auth-casbin-node-casbin         | evidence-needed | unverified-prohibited-constraint |                      1 | [ev-9fbd68343089b0eb99e551fec718aedac9d8d5f7, artifact-evidence-1043e012fa62346177938ea4b1f627ecff67b28e, artifact-evidence-37a5d83a039e2b54ce89d28ce0092a0c8362fea2, artifact-evidence-3a7c582175d3307927f9ce8d8af8dcac9e356e7f, ev-a1d189bf726d793724b034fd56f98dab56312038]                                                                                                                                                       | [unk-8538c6db70ce6362931c72431ccbfe42c9bf77f7, unk-a15707136190e56f81c748db2b60f9e00dc5000f, assessment-unknown-476209a73805ed45f675f6338230a612eee4b02864361, assessment-unknown-479c61bfbe09c5904a528eb7dd83cfe1822aae43350ce]                                               | viable      |
| authorization-next-vercel-drizzle              | auth-casbin-casbin              | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-15de1d65cba130055ca4e3a3bcb541f99793cc97, artifact-evidence-c558152924def1d1797f369e610759da05fd34e9, artifact-evidence-05159ffc0466aa4b7a5c8dd400b1cae2d726057c, artifact-evidence-6daafdac6c2eecbbc33249f1d440ba9e333a510c, ev-c3bb8ffe2606edb7ef5c0f6c8bb6ab748351d65f]                                                                                                                                        | [unk-acb2a8b67b802d4a3290bb0e0c7e0b5c3361201e, unk-f473d94aba03390e6f9426489c7e9330e6c607eb, assessment-unknown-903c91a3f6625f5b9751c285e008a83ca419c50743a0c, assessment-unknown-1382eb6926324a6365fed0d94bbdd41b8b50646186963]                                               | viable      |
| authorization-next-vercel-drizzle              | auth-casbin-casbin-js           | evidence-needed | unverified-prohibited-constraint |                      1 | [ev-cd82e507ca536887819663632baa5fc3c7593e3d, artifact-evidence-2e07e70680280f50531209d25a663a57c20678bf, artifact-evidence-f24f6304538f657127d9c525698d485a38c937df, ev-20fffa0efde9b27f20d7fc34c87a634799f60980]                                                                                                                                                                                                                   | [unk-2c2b6c80edfb2e5ce987787c768f514f16313672, assessment-unknown-e9d3d9899334ba3a3a3fb573ce27e7e1d67aa91f4c0e4, assessment-unknown-76c5bd4bcc3deb7754df29750fc32da6afa439bc41492]                                                                                             | viable      |
| authorization-express-container-prisma-redis   | auth-casbin-node-casbin         | evidence-needed | fully-verified                   |                      0 | [ev-9fbd68343089b0eb99e551fec718aedac9d8d5f7, artifact-evidence-1043e012fa62346177938ea4b1f627ecff67b28e, artifact-evidence-37a5d83a039e2b54ce89d28ce0092a0c8362fea2, ev-a1d189bf726d793724b034fd56f98dab56312038]                                                                                                                                                                                                                   | []                                                                                                                                                                                                                                                                             | viable      |
| authorization-next-selfhosted-drizzle          | auth-casbin-node-casbin         | evidence-needed | unverified-prohibited-constraint |                      3 | [ev-9fbd68343089b0eb99e551fec718aedac9d8d5f7, artifact-evidence-1043e012fa62346177938ea4b1f627ecff67b28e, artifact-evidence-37a5d83a039e2b54ce89d28ce0092a0c8362fea2, artifact-evidence-3a7c582175d3307927f9ce8d8af8dcac9e356e7f, ev-a1d189bf726d793724b034fd56f98dab56312038]                                                                                                                                                       | [unk-2d55a7fa4fbbd58b4817cc8749c5a5e3a7c91a06, unk-8538c6db70ce6362931c72431ccbfe42c9bf77f7, unk-a15707136190e56f81c748db2b60f9e00dc5000f, assessment-unknown-e31197f37d51f319c3b5516c4f7d5b7ebe3acd1181d8b, assessment-unknown-7b0170ab2ba7cd7ff2c54cf5efab5825916730f1b4f12] | viable      |
| authorization-next-selfhosted-drizzle          | auth-casbin-casbin              | evidence-needed | unverified-prohibited-constraint |                      3 | [artifact-evidence-15de1d65cba130055ca4e3a3bcb541f99793cc97, artifact-evidence-c558152924def1d1797f369e610759da05fd34e9, artifact-evidence-05159ffc0466aa4b7a5c8dd400b1cae2d726057c, artifact-evidence-6daafdac6c2eecbbc33249f1d440ba9e333a510c, artifact-evidence-90c510271d95e3da473d55d73117d860286d8761, artifact-evidence-71bc949203d7ce1d5d97c100515951510575c1e7, ev-c3bb8ffe2606edb7ef5c0f6c8bb6ab748351d65f]                | [unk-acb2a8b67b802d4a3290bb0e0c7e0b5c3361201e, unk-f473d94aba03390e6f9426489c7e9330e6c607eb, assessment-unknown-2c375fe43d083d5d7bb539b8cf0491619c7fa712c249b, assessment-unknown-74083dcd837a89be880e41ed7ae006e6ddf8e7c32f84e]                                               | viable      |
| audit-logging-next-vercel-drizzle              | audit-roarr                     | evidence-needed | unverified-prohibited-constraint |                      1 | [ev-e281aa00f5e9ac8db0ddf7d62bc8dacd2dd3bd60, artifact-evidence-15efffefabaa1e3387218002daa8e9a0ea911119, artifact-evidence-83f13510eb1011d211d01ab996dcfd68c9b513ca, artifact-evidence-7b9b3ae6aba486ec8c3b4108a72995f20986723b, artifact-evidence-523b333c536e89bf44c86637bf9dc50db9f4aade, artifact-evidence-152c7aeafca85693ed6deb1b4e8e0a0e55f61e83]                                                                            | [unk-96429b1f165a68a1b782b26d115e499777ee69b3, assessment-unknown-2d216eeea14a654cef279f74531e402a7cc2d894ab1d3, assessment-unknown-044d1670fcb4b9240cb403acc9b604ea0c93820b55ea7]                                                                                             | viable      |
| audit-logging-next-selfhosted-drizzle          | audit-roarr                     | evidence-needed | unverified-prohibited-constraint |                      3 | [artifact-evidence-15efffefabaa1e3387218002daa8e9a0ea911119, artifact-evidence-83f13510eb1011d211d01ab996dcfd68c9b513ca, artifact-evidence-7b9b3ae6aba486ec8c3b4108a72995f20986723b, artifact-evidence-7f5f98e66943d4efcf57b7cd6f7c39174765e757, artifact-evidence-6b206dda61ee1e3d79a2538c11c526db7a64b315]                                                                                                                         | [unk-96429b1f165a68a1b782b26d115e499777ee69b3, assessment-unknown-00091f66f2bc0c26e7a25bcd378fb05367a3a0aa76e74, assessment-unknown-8f4c053788aae1022f7748a66f2953de1e45df100bd14]                                                                                             | viable      |
| background-jobs-next-vercel-drizzle            | jobs-agenda                     | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-56554adc9e54719c94ff48de3f5fa8ca9005b9ba, artifact-evidence-312be5ce4f6724e6dba8e0eef207b994af4a1e18, artifact-evidence-e35b1a3d47dce5e5a6c31eb5175f29f1befcd3c0, artifact-evidence-94e397c1e6fed20a15c05248e890fa296f1dd79c, artifact-evidence-566537718b516b3fa460a0cdd7e810983ee14133, artifact-evidence-b43c38328463e9621c6a7015b88949c5d9776b4b]                                                             | [unk-7c270317506bc956f2a2daf3ccee17d9de2e13d4, assessment-unknown-92240144fbc02a1f07f27dbd87f48ec3236de43eb5346, assessment-unknown-b948fcc140c6bc1456590a98cd3952dae04813dc1d387, assessment-unknown-2a4800fb22a28dfd87d74a90f324651621f99f67ae775]                           | viable      |
| background-jobs-express-container-prisma-redis | jobs-agenda                     | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-56554adc9e54719c94ff48de3f5fa8ca9005b9ba, artifact-evidence-312be5ce4f6724e6dba8e0eef207b994af4a1e18, artifact-evidence-e35b1a3d47dce5e5a6c31eb5175f29f1befcd3c0, artifact-evidence-94e397c1e6fed20a15c05248e890fa296f1dd79c]                                                                                                                                                                                     | [unk-7c270317506bc956f2a2daf3ccee17d9de2e13d4, assessment-unknown-12a4577e134f000a1d9c060034aa08e66b34a106b1b08]                                                                                                                                                               | recommended |
| background-jobs-express-container-prisma-redis | jobs-rq                         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-e94f2ecd5662420a9bee767afa09ea7a9365db23, artifact-evidence-3d669caa8c14f65cf4de8edbb94d2ab402d79c2c, artifact-evidence-43a17273a70e61df6f92d0452c3064762ba72a46]                                                                                                                                                                                                                                                 | [unk-33cc2dd7d751f669e03211140b442b257c279bdc, unk-8ce86174d4bc7e14b1c3c1abcf9f4f9a195bfdf4, assessment-unknown-0b54f50e192f18beb221705ae19b8271815378a60c0fc]                                                                                                                 | viable      |
| background-jobs-next-selfhosted-drizzle        | jobs-agenda                     | evidence-needed | unverified-prohibited-constraint |                      3 | [artifact-evidence-56554adc9e54719c94ff48de3f5fa8ca9005b9ba, artifact-evidence-312be5ce4f6724e6dba8e0eef207b994af4a1e18, artifact-evidence-e35b1a3d47dce5e5a6c31eb5175f29f1befcd3c0, artifact-evidence-94e397c1e6fed20a15c05248e890fa296f1dd79c, artifact-evidence-566537718b516b3fa460a0cdd7e810983ee14133, artifact-evidence-b43c38328463e9621c6a7015b88949c5d9776b4b, artifact-evidence-2aa9d210a813b05129b45ae90e64743bb3d780ce] | [unk-7c270317506bc956f2a2daf3ccee17d9de2e13d4, assessment-unknown-437b38b2130b5ef2de67cf0ef81d4033a8babe451e004, assessment-unknown-6a567cbdc9185129554a74415d24758fa3812a18c9617]                                                                                             | viable      |
| rate-limiting-next-vercel-drizzle              | rate-express-rate-limit         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-8225fbdbff1a96c6fd1dfe53f996c16e53b0ec58, artifact-evidence-7f0fea9b28d7b7c49911ef9f599f00d0a3fb0f49]                                                                                                                                                                                                                                                                                                             | [assessment-unknown-7ba29e674440d567c931449eacaa9c466db18d4b6b12b, assessment-unknown-9d9ff2fd4df06bd1ff5164245d1b4a840e5019db28248]                                                                                                                                           | viable      |
| rate-limiting-next-vercel-drizzle              | rate-fastify-rate-limit         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-5f3e183b5a6498a5891ed8368e61163754f003b6, artifact-evidence-0550fa0163cd72ff7a0bc94b7b98119054f64cef]                                                                                                                                                                                                                                                                                                             | [assessment-unknown-e0a2c8587399481664c7f209375d2354736d9b3a2d132, assessment-unknown-6bcb7aa8878713e388da43683521a96d7ce35e7b2c9d2]                                                                                                                                           | viable      |
| rate-limiting-next-vercel-drizzle              | rate-node-rate-limiter-flexible | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf, artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f]                                                                                                                                                                                                                                                                                                             | [assessment-unknown-a1db2cbc3ae0ca788d944bcd526770d349ef728970205, assessment-unknown-d7c49be99f73300dd97ae64c71d4910bb133ef0cc6496]                                                                                                                                           | viable      |
| rate-limiting-express-container-prisma-redis   | rate-express-rate-limit         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-8225fbdbff1a96c6fd1dfe53f996c16e53b0ec58, artifact-evidence-7f0fea9b28d7b7c49911ef9f599f00d0a3fb0f49]                                                                                                                                                                                                                                                                                                             | []                                                                                                                                                                                                                                                                             | recommended |
| rate-limiting-express-container-prisma-redis   | rate-node-rate-limiter-flexible | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf, artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f]                                                                                                                                                                                                                                                                                                             | []                                                                                                                                                                                                                                                                             | viable      |
| rate-limiting-express-container-prisma-redis   | rate-fastify-rate-limit         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-5f3e183b5a6498a5891ed8368e61163754f003b6, artifact-evidence-0550fa0163cd72ff7a0bc94b7b98119054f64cef]                                                                                                                                                                                                                                                                                                             | []                                                                                                                                                                                                                                                                             | viable      |
| rate-limiting-next-selfhosted-drizzle          | rate-express-rate-limit         | evidence-needed | unverified-prohibited-constraint |                      2 | [artifact-evidence-8225fbdbff1a96c6fd1dfe53f996c16e53b0ec58, artifact-evidence-7f0fea9b28d7b7c49911ef9f599f00d0a3fb0f49, artifact-evidence-edec3e57ac3534601dbc154c0cf222312c8b8092]                                                                                                                                                                                                                                                 | [unk-70b920f4c31daf52dca790a9d2ee57d5e054c96c, assessment-unknown-d48946844af3f8772fe9d52f477fc10ec45dd5906c608]                                                                                                                                                               | viable      |
| rate-limiting-next-selfhosted-drizzle          | rate-fastify-rate-limit         | evidence-needed | unverified-prohibited-constraint |                      2 | [artifact-evidence-5f3e183b5a6498a5891ed8368e61163754f003b6, artifact-evidence-0550fa0163cd72ff7a0bc94b7b98119054f64cef, artifact-evidence-f5f48ad91beaf7d2152f5bbcf116608d41890241]                                                                                                                                                                                                                                                 | [unk-0921899a79a2427f2f10c448f1b4595167572a34, assessment-unknown-fc551271f23fbe2e1668b196a1978a4ec71c3fcb625d1]                                                                                                                                                               | viable      |
| rate-limiting-next-selfhosted-drizzle          | rate-node-rate-limiter-flexible | evidence-needed | unverified-prohibited-constraint |                      2 | [artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf, artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f, ev-7ad2a98d02e2d3b3985452cfb0ba2cee08f891c2]                                                                                                                                                                                                                                                                | [unk-99493d5e13f3af0e2719524aafafe3e0368f118c, assessment-unknown-75a37ecede31f827b05ef66d9e0c206c0fb694f25f7df]                                                                                                                                                               | viable      |
| webhooks-next-vercel-drizzle                   | webhook-standard-webhooks       | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-b4696e47dcc0d5627df6c1762a7699319615a601, artifact-evidence-e37bdb1fdb927a8762567a7d314d7c6181a1fc63, artifact-evidence-3dc02ec99ec26d56034d111ef3a1d4d73b1c997c, artifact-evidence-1b52cd51778fa33e92a715f9f588b8830fc94031, artifact-evidence-6db70c09a00e8d4ba3811dd408bcca617d2264fa, ev-a6bfff68d12935a8f8f1c5579b638f63b72ac400]                                                                            | [unk-6aaec47758d76c5f40c7d135da75c7e56edd72e2, assessment-unknown-97e272a8ece638081bf67b86bb29c4b817e3333fc6fc0, assessment-unknown-301071e22477fd6fd10be5c8790596a5ee65b0c6487de]                                                                                             | recommended |
| webhooks-express-container-prisma-redis        | webhook-svix                    | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-4e97f0e405f925595fd96f7c2201c78a7014d5ff, artifact-evidence-d5e2cd094b67c01dd3c19b54e89f31d60751abda, ev-40f7f3a9aad23b56dbc916d0dea2a4aa7932c9bb, artifact-evidence-721b0a360d115f71c971f67d87245154b15a0329]                                                                                                                                                                                                    | [unk-88ed064aeaaa32dffb33cb8f026a5f6889c0d854, assessment-unknown-337cee4c5e706a8954945327e8ecbc33e24ebc61a7d64]                                                                                                                                                               | viable      |

## Model calls

Total model calls made: 15.

Completed model calls: 15.

Deterministically valid responses: 15.

Median completed-call latency: 30699.8 ms.

Maximum completed-call latency: 42631.7 ms.

Median output tokens: 3368.0.

## Assessment diagnostics

Model responses captured for diagnostics: 15 of 15 fixtures.

Harness canonical validations passed: 15.

Diagnostic capture failures: 0.

Unknown totals include supplied candidate unknowns plus model-declared assessment unknowns; limitation totals are the supplied candidate limitation catalog hydrated by validation.

### Domain issue categories

No domain validation issues.

### Disposition totals

| Disposition           | Count |
| --------------------- | ----: |
| recommended           |     3 |
| viable                |    20 |
| rejected              |     2 |
| insufficient-evidence |    50 |

### Hard-resolution state totals

| State      | Count |
| ---------- | ----: |
| satisfied  |    63 |
| conflict   |     2 |
| unresolved |   145 |

### Declared catalog totals

| Catalog     | Count |
| ----------- | ----: |
| inferences  |   124 |
| claims      |    98 |
| unknowns    |   309 |
| limitations |     9 |
| conflicts   |     2 |

Fixtures with any satisfied hard resolution: 15.

Candidates with any satisfied hard resolution: 49.

Fixtures with a rejected disposition on a declared conflict: 2.

Candidates with a rejected disposition on a declared conflict: 2.

### Per-fixture diagnostic totals

| Fixture                                        | Response | Validation | Domain issues | Dispositions                                                 | Resolutions                            | Catalogs                                                          | Any satisfied | Rejected conflict |
| ---------------------------------------------- | -------- | ---------- | ------------: | ------------------------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------- | ------------- | ----------------- |
| authorization-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=7  | inferences=8, claims=5, unknowns=21, limitations=3, conflicts=0   | yes           | no                |
| authorization-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=1, rejected=0, insufficient-evidence=4 | satisfied=3, conflict=0, unresolved=2  | inferences=4, claims=5, unknowns=11, limitations=3, conflicts=0   | yes           | no                |
| authorization-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=2, rejected=0, insufficient-evidence=3 | satisfied=3, conflict=0, unresolved=17 | inferences=12, claims=9, unknowns=21, limitations=3, conflicts=0  | yes           | no                |
| audit-logging-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=1, rejected=0, insufficient-evidence=4 | satisfied=3, conflict=0, unresolved=12 | inferences=6, claims=7, unknowns=26, limitations=0, conflicts=0   | yes           | no                |
| audit-logging-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=2, conflict=0, unresolved=8  | inferences=6, claims=7, unknowns=20, limitations=0, conflicts=0   | yes           | no                |
| audit-logging-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=1, rejected=0, insufficient-evidence=4 | satisfied=3, conflict=0, unresolved=22 | inferences=9, claims=6, unknowns=24, limitations=0, conflicts=0   | yes           | no                |
| background-jobs-next-vercel-drizzle            | captured | passed     |             0 | recommended=0, viable=1, rejected=0, insufficient-evidence=4 | satisfied=6, conflict=0, unresolved=9  | inferences=9, claims=8, unknowns=27, limitations=0, conflicts=0   | yes           | no                |
| background-jobs-express-container-prisma-redis | captured | passed     |             0 | recommended=1, viable=1, rejected=0, insufficient-evidence=3 | satisfied=6, conflict=0, unresolved=4  | inferences=12, claims=7, unknowns=17, limitations=0, conflicts=0  | yes           | no                |
| background-jobs-next-selfhosted-drizzle        | captured | passed     |             0 | recommended=0, viable=1, rejected=0, insufficient-evidence=4 | satisfied=5, conflict=0, unresolved=20 | inferences=7, claims=6, unknowns=21, limitations=0, conflicts=0   | yes           | no                |
| rate-limiting-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=2  | inferences=6, claims=3, unknowns=22, limitations=0, conflicts=0   | yes           | no                |
| rate-limiting-express-container-prisma-redis   | captured | passed     |             0 | recommended=1, viable=2, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=2  | inferences=6, claims=3, unknowns=17, limitations=0, conflicts=0   | yes           | no                |
| rate-limiting-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=12 | inferences=6, claims=3, unknowns=19, limitations=0, conflicts=0   | yes           | no                |
| webhooks-next-vercel-drizzle                   | captured | passed     |             0 | recommended=1, viable=0, rejected=1, insufficient-evidence=3 | satisfied=7, conflict=1, unresolved=7  | inferences=11, claims=12, unknowns=20, limitations=0, conflicts=1 | yes           | yes               |
| webhooks-express-container-prisma-redis        | captured | passed     |             0 | recommended=0, viable=1, rejected=0, insufficient-evidence=4 | satisfied=6, conflict=0, unresolved=4  | inferences=13, claims=7, unknowns=18, limitations=0, conflicts=0  | yes           | no                |
| webhooks-next-selfhosted-drizzle               | captured | passed     |             0 | recommended=0, viable=0, rejected=1, insufficient-evidence=4 | satisfied=7, conflict=1, unresolved=17 | inferences=9, claims=10, unknowns=25, limitations=0, conflicts=1  | yes           | yes               |

## Failure categories

No failed calls.
