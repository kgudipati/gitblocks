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
| recommend              |    12 |
| failed                 |     0 |

## Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     0 |                   0 |         3 |      0 |
| audit-logging     |                      0 |           0 |                     2 |                   0 |         1 |      0 |
| background-jobs   |                      0 |           0 |                     1 |                   0 |         2 |      0 |
| rate-limiting     |                      0 |           0 |                     0 |                   0 |         3 |      0 |
| webhooks          |                      0 |           0 |                     0 |                   0 |         3 |      0 |

## Non-recommend outcomes

| Fixture                                      | Outcome               | Producing stage                     | Reason                               |
| -------------------------------------------- | --------------------- | ----------------------------------- | ------------------------------------ |
| audit-logging-express-container-prisma-redis | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-next-selfhosted-drizzle        | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| background-jobs-next-selfhosted-drizzle      | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |

## Insufficient-evidence detail

| Fixture                                      | Unresolved hard evaluations per finalist | Artifact excerpt available per finalist |
| -------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| audit-logging-express-container-prisma-redis | [2, 2, 1, 1, 2]                          | [yes, yes, yes, yes, yes]               |
| audit-logging-next-selfhosted-drizzle        | [5, 5, 5, 5, 5]                          | [yes, yes, yes, yes, yes]               |
| background-jobs-next-selfhosted-drizzle      | [5, 5, 5, 5, 5]                          | [yes, yes, yes, yes, yes]               |

## Recommend detail

| Fixture                                        | Options returned | Eligible-lane options | Evidence-needed-lane options | Options with unverified constraints |
| ---------------------------------------------- | ---------------: | --------------------: | ---------------------------: | ----------------------------------: |
| authorization-next-vercel-drizzle              |                3 |                     0 |                            3 |                                   3 |
| authorization-express-container-prisma-redis   |                2 |                     0 |                            2 |                                   0 |
| authorization-next-selfhosted-drizzle          |                3 |                     0 |                            3 |                                   3 |
| audit-logging-next-vercel-drizzle              |                2 |                     0 |                            2 |                                   2 |
| background-jobs-next-vercel-drizzle            |                1 |                     0 |                            1 |                                   1 |
| background-jobs-express-container-prisma-redis |                2 |                     0 |                            2 |                                   0 |
| rate-limiting-next-vercel-drizzle              |                3 |                     0 |                            3 |                                   0 |
| rate-limiting-express-container-prisma-redis   |                2 |                     0 |                            2 |                                   0 |
| rate-limiting-next-selfhosted-drizzle          |                3 |                     0 |                            3 |                                   3 |
| webhooks-next-vercel-drizzle                   |                1 |                     0 |                            1 |                                   1 |
| webhooks-express-container-prisma-redis        |                2 |                     0 |                            2 |                                   0 |
| webhooks-next-selfhosted-drizzle               |                1 |                     0 |                            1 |                                   1 |

### Recommended option detail

| Fixture                                        | Candidate ID                    | Lane            | Verification                     | Unverified constraints | Evidence references                                                                                                                                                                                                                                                                                                                                                      | Material unknowns                                                                                                                                                                                                                                                              | Disposition |
| ---------------------------------------------- | ------------------------------- | --------------- | -------------------------------- | ---------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| authorization-next-vercel-drizzle              | auth-casbin-casbin              | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-15de1d65cba130055ca4e3a3bcb541f99793cc97, artifact-evidence-c558152924def1d1797f369e610759da05fd34e9, ev-c3bb8ffe2606edb7ef5c0f6c8bb6ab748351d65f, artifact-evidence-05159ffc0466aa4b7a5c8dd400b1cae2d726057c, artifact-evidence-6daafdac6c2eecbbc33249f1d440ba9e333a510c]                                                                            | [unk-acb2a8b67b802d4a3290bb0e0c7e0b5c3361201e, assessment-unknown-1d3218ddd136015f0694679016a83b0b33cb26b6873c6, assessment-unknown-95d62d8f2b262179b70a349c91e8d22f92abfc8a6c29e]                                                                                             | viable      |
| authorization-next-vercel-drizzle              | auth-casbin-node-casbin         | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-1043e012fa62346177938ea4b1f627ecff67b28e, artifact-evidence-37a5d83a039e2b54ce89d28ce0092a0c8362fea2, ev-a1d189bf726d793724b034fd56f98dab56312038, artifact-evidence-3a7c582175d3307927f9ce8d8af8dcac9e356e7f]                                                                                                                                        | [unk-8538c6db70ce6362931c72431ccbfe42c9bf77f7, assessment-unknown-9f2078d4ea90f8aa27a9e230d42267a1790bf9a7a0430, assessment-unknown-40ec3ef01c184cbf461b6102548c1f49b07f5d4dc4274]                                                                                             | viable      |
| authorization-next-vercel-drizzle              | auth-casbin-casbin-js           | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-2e07e70680280f50531209d25a663a57c20678bf, artifact-evidence-f24f6304538f657127d9c525698d485a38c937df, ev-20fffa0efde9b27f20d7fc34c87a634799f60980]                                                                                                                                                                                                    | [unk-2c2b6c80edfb2e5ce987787c768f514f16313672, assessment-unknown-2373fac02b81631fecc4a9b1ecf6e1ff1cd9463e1c030, assessment-unknown-08106b202700080c2e8680ee81cd441cdc1c004643010]                                                                                             | viable      |
| authorization-express-container-prisma-redis   | auth-casbin-node-casbin         | evidence-needed | fully-verified                   |                      0 | [ev-9fbd68343089b0eb99e551fec718aedac9d8d5f7, ev-a1d189bf726d793724b034fd56f98dab56312038, artifact-evidence-1043e012fa62346177938ea4b1f627ecff67b28e, artifact-evidence-37a5d83a039e2b54ce89d28ce0092a0c8362fea2]                                                                                                                                                       | [unk-2d55a7fa4fbbd58b4817cc8749c5a5e3a7c91a06, unk-8538c6db70ce6362931c72431ccbfe42c9bf77f7, unk-a15707136190e56f81c748db2b60f9e00dc5000f, assessment-unknown-753b0dc3c91e44e609d1ca468acbb7c42bdcb9fb0b25b, assessment-unknown-0866903aeeffffa7fe5107dcd15d2ad20c38c4b372f21] | recommended |
| authorization-express-container-prisma-redis   | auth-casbin-casbin              | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-15de1d65cba130055ca4e3a3bcb541f99793cc97, artifact-evidence-c558152924def1d1797f369e610759da05fd34e9, ev-c3bb8ffe2606edb7ef5c0f6c8bb6ab748351d65f]                                                                                                                                                                                                    | [unk-acb2a8b67b802d4a3290bb0e0c7e0b5c3361201e, unk-f473d94aba03390e6f9426489c7e9330e6c607eb, assessment-unknown-95570a5d6cb532233b369a76e6c8e0ea8700c8a9bb07a, assessment-unknown-6f5089f5d0f740f02ab82f5b46d17c2d580e99a94fca0]                                               | viable      |
| authorization-next-selfhosted-drizzle          | auth-casbin-node-casbin         | evidence-needed | unverified-prohibited-constraint |                      3 | [artifact-evidence-1043e012fa62346177938ea4b1f627ecff67b28e, artifact-evidence-37a5d83a039e2b54ce89d28ce0092a0c8362fea2, artifact-evidence-3a7c582175d3307927f9ce8d8af8dcac9e356e7f, ev-a1d189bf726d793724b034fd56f98dab56312038]                                                                                                                                        | [assessment-unknown-f69ceb2e24c19239e2151fdf411b7a037705a664ba483]                                                                                                                                                                                                             | viable      |
| authorization-next-selfhosted-drizzle          | auth-casbin-casbin              | evidence-needed | unverified-prohibited-constraint |                      3 | [artifact-evidence-15de1d65cba130055ca4e3a3bcb541f99793cc97, artifact-evidence-c558152924def1d1797f369e610759da05fd34e9, artifact-evidence-05159ffc0466aa4b7a5c8dd400b1cae2d726057c, artifact-evidence-6daafdac6c2eecbbc33249f1d440ba9e333a510c, ev-c3bb8ffe2606edb7ef5c0f6c8bb6ab748351d65f]                                                                            | [assessment-unknown-293f4959ba8d723a3141fdd987698e13d89346c5ca2a8]                                                                                                                                                                                                             | viable      |
| authorization-next-selfhosted-drizzle          | auth-casbin-casbin-js           | evidence-needed | unverified-prohibited-constraint |                      3 | [artifact-evidence-2e07e70680280f50531209d25a663a57c20678bf, artifact-evidence-f24f6304538f657127d9c525698d485a38c937df, ev-20fffa0efde9b27f20d7fc34c87a634799f60980]                                                                                                                                                                                                    | [assessment-unknown-6a306706c79f45a5f1673910797f84e0185ccd45534e3]                                                                                                                                                                                                             | viable      |
| audit-logging-next-vercel-drizzle              | audit-pino-http                 | evidence-needed | unverified-prohibited-constraint |                      2 | [artifact-evidence-4bc7b0c7a1e3f4b625446b50dc08ab5da8799e57, artifact-evidence-20f09adad3d08d9618f1707af53ce5705edf5542, artifact-evidence-17bc17113ad627384013010f1acca45e8c41e539, ev-34499e639679b24b7bc271cdaaf187be0e42ad4c]                                                                                                                                        | [unk-621b53653c7949d48923237c857518841cfbf91c, assessment-unknown-b7ba7e4efd9526b932e9fce0e6416f7038ef043b64c75, assessment-unknown-46c73b98a61c4f8b8226d83359a7258fcb9ca875b0221]                                                                                             | viable      |
| audit-logging-next-vercel-drizzle              | audit-roarr                     | evidence-needed | unverified-prohibited-constraint |                      2 | [artifact-evidence-15efffefabaa1e3387218002daa8e9a0ea911119, artifact-evidence-83f13510eb1011d211d01ab996dcfd68c9b513ca, artifact-evidence-7b9b3ae6aba486ec8c3b4108a72995f20986723b, ev-e281aa00f5e9ac8db0ddf7d62bc8dacd2dd3bd60]                                                                                                                                        | [unk-96429b1f165a68a1b782b26d115e499777ee69b3, assessment-unknown-b5f4e421d2e1f247f6d40e0d39ce0ad3c00c4a9443d62, assessment-unknown-bc4a0ea215b950cfc6cdfec097edf2dc478335d2d53e5]                                                                                             | viable      |
| background-jobs-next-vercel-drizzle            | jobs-agenda                     | evidence-needed | unverified-prohibited-constraint |                      3 | [artifact-evidence-56554adc9e54719c94ff48de3f5fa8ca9005b9ba, artifact-evidence-312be5ce4f6724e6dba8e0eef207b994af4a1e18, artifact-evidence-e35b1a3d47dce5e5a6c31eb5175f29f1befcd3c0, artifact-evidence-94e397c1e6fed20a15c05248e890fa296f1dd79c, artifact-evidence-566537718b516b3fa460a0cdd7e810983ee14133, artifact-evidence-b43c38328463e9621c6a7015b88949c5d9776b4b] | [unk-7c270317506bc956f2a2daf3ccee17d9de2e13d4, assessment-unknown-cd6ce96b55f736d133b9d744a21caba2910d592b0d18c, assessment-unknown-d0ff3abb1652eaecb57088ae6751158a1adb41bccd18d, assessment-unknown-9baabe92c19c127371492c1f57ef8d143cc993f4d5881]                           | viable      |
| background-jobs-express-container-prisma-redis | jobs-agenda                     | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-56554adc9e54719c94ff48de3f5fa8ca9005b9ba, artifact-evidence-312be5ce4f6724e6dba8e0eef207b994af4a1e18, artifact-evidence-e35b1a3d47dce5e5a6c31eb5175f29f1befcd3c0, artifact-evidence-94e397c1e6fed20a15c05248e890fa296f1dd79c, ev-1e141696eca7fcc827b5439b594f017ac6bdd775]                                                                            | [unk-7c270317506bc956f2a2daf3ccee17d9de2e13d4, assessment-unknown-577bb7b59576bba745051f702e3a43b3b720677a52e78]                                                                                                                                                               | viable      |
| background-jobs-express-container-prisma-redis | jobs-rq                         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-e94f2ecd5662420a9bee767afa09ea7a9365db23, artifact-evidence-3d669caa8c14f65cf4de8edbb94d2ab402d79c2c, artifact-evidence-43a17273a70e61df6f92d0452c3064762ba72a46]                                                                                                                                                                                     | [unk-33cc2dd7d751f669e03211140b442b257c279bdc, assessment-unknown-f016711616dcb2e1fcb69a5ae301622403b798d3ce8c2]                                                                                                                                                               | viable      |
| rate-limiting-next-vercel-drizzle              | rate-express-rate-limit         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-8225fbdbff1a96c6fd1dfe53f996c16e53b0ec58, artifact-evidence-7f0fea9b28d7b7c49911ef9f599f00d0a3fb0f49, ev-8e72a255108bece4e257d4f773ea8b1d3beaffd3]                                                                                                                                                                                                    | [unk-70b920f4c31daf52dca790a9d2ee57d5e054c96c, assessment-unknown-406e90b73ba872a96be1dc9903d6e9659a9e5edc1f7c1]                                                                                                                                                               | viable      |
| rate-limiting-next-vercel-drizzle              | rate-fastify-rate-limit         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-5f3e183b5a6498a5891ed8368e61163754f003b6, artifact-evidence-0550fa0163cd72ff7a0bc94b7b98119054f64cef, ev-a58276612334cef70d447e4eef13b70d46a63cc4]                                                                                                                                                                                                    | [unk-0921899a79a2427f2f10c448f1b4595167572a34, assessment-unknown-c2d31aece739c7b2764d98ca3828ab77e4f95e5a52a29]                                                                                                                                                               | viable      |
| rate-limiting-next-vercel-drizzle              | rate-node-rate-limiter-flexible | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf, artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f, ev-7ad2a98d02e2d3b3985452cfb0ba2cee08f891c2]                                                                                                                                                                                                    | [unk-99493d5e13f3af0e2719524aafafe3e0368f118c, assessment-unknown-cc2bf10ddc8cb529159a38a5fe9fa6efdbc26508f0869]                                                                                                                                                               | viable      |
| rate-limiting-express-container-prisma-redis   | rate-express-rate-limit         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-8225fbdbff1a96c6fd1dfe53f996c16e53b0ec58, artifact-evidence-7f0fea9b28d7b7c49911ef9f599f00d0a3fb0f49]                                                                                                                                                                                                                                                 | [assessment-unknown-f9a80274e87c22617e6759aa7c4355f4be3aad3d907e3]                                                                                                                                                                                                             | recommended |
| rate-limiting-express-container-prisma-redis   | rate-node-rate-limiter-flexible | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f, artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf]                                                                                                                                                                                                                                                 | [assessment-unknown-cf64d8a44dbb365b41a289db81943fcf6eaacbfafa09e]                                                                                                                                                                                                             | viable      |
| rate-limiting-next-selfhosted-drizzle          | rate-express-rate-limit         | evidence-needed | unverified-prohibited-constraint |                      2 | [artifact-evidence-8225fbdbff1a96c6fd1dfe53f996c16e53b0ec58, artifact-evidence-7f0fea9b28d7b7c49911ef9f599f00d0a3fb0f49]                                                                                                                                                                                                                                                 | [assessment-unknown-d759e00f2f3ac3db7b446aec02d5128c75c0bd51b829a, assessment-unknown-95d25da30ed67a35e1b42541295ec8e44d3a8207fd2bf]                                                                                                                                           | viable      |
| rate-limiting-next-selfhosted-drizzle          | rate-fastify-rate-limit         | evidence-needed | unverified-prohibited-constraint |                      2 | [artifact-evidence-5f3e183b5a6498a5891ed8368e61163754f003b6, artifact-evidence-0550fa0163cd72ff7a0bc94b7b98119054f64cef]                                                                                                                                                                                                                                                 | [assessment-unknown-743b9f7547ca1dbfcdf3874d8115e9388f03d446b5323, assessment-unknown-9104767f07a6b47d938db0c83e0b0afb7513eea4688fd]                                                                                                                                           | viable      |
| rate-limiting-next-selfhosted-drizzle          | rate-node-rate-limiter-flexible | evidence-needed | unverified-prohibited-constraint |                      2 | [artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf, artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f]                                                                                                                                                                                                                                                 | [assessment-unknown-73806fd2dcf6050a296613c69587110da4da4d650aad6, assessment-unknown-259569d90edeef6e6688607692a6572c28db41b5d6ccd]                                                                                                                                           | viable      |
| webhooks-next-vercel-drizzle                   | webhook-standard-webhooks       | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-b4696e47dcc0d5627df6c1762a7699319615a601, artifact-evidence-e37bdb1fdb927a8762567a7d314d7c6181a1fc63, artifact-evidence-3dc02ec99ec26d56034d111ef3a1d4d73b1c997c, artifact-evidence-1b52cd51778fa33e92a715f9f588b8830fc94031, artifact-evidence-6db70c09a00e8d4ba3811dd408bcca617d2264fa, ev-a6bfff68d12935a8f8f1c5579b638f63b72ac400]                | [unk-6aaec47758d76c5f40c7d135da75c7e56edd72e2, assessment-unknown-0583ffaa265b246e872e2e3194ad4fdea3876907f042f, assessment-unknown-d0f4dba7daba0e0a0accc7d2af6cfa9c2015a2d0277dc]                                                                                             | viable      |
| webhooks-express-container-prisma-redis        | webhook-svix                    | evidence-needed | fully-verified                   |                      0 | [ev-40f7f3a9aad23b56dbc916d0dea2a4aa7932c9bb, artifact-evidence-4e97f0e405f925595fd96f7c2201c78a7014d5ff, artifact-evidence-d5e2cd094b67c01dd3c19b54e89f31d60751abda, artifact-evidence-721b0a360d115f71c971f67d87245154b15a0329]                                                                                                                                        | [unk-88ed064aeaaa32dffb33cb8f026a5f6889c0d854, assessment-unknown-045e8a30cb82f0b42e7da0b0da5feb7ad886ad57ab6ee]                                                                                                                                                               | recommended |
| webhooks-express-container-prisma-redis        | webhook-adnanh                  | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-9f1184779a8966ef4f99d85ccd16cf71cdc4ec13, artifact-evidence-c7ac0cbedef93bf65380934970e847f41718353e, artifact-evidence-204191e0bf025ba7210d1d52af8d63b1bd4c2217]                                                                                                                                                                                     | [unk-5537a25a75980ae8b6cf91744c32b1e6fd3807b0, unk-9bab042fcdc928b2ed1f19129bf6c355d6693c62, assessment-unknown-329cee5e28d1990b29d17acee0c3503c68bcb3bbff616]                                                                                                                 | viable      |
| webhooks-next-selfhosted-drizzle               | webhook-standard-webhooks       | evidence-needed | unverified-prohibited-constraint |                      3 | [artifact-evidence-b4696e47dcc0d5627df6c1762a7699319615a601, artifact-evidence-e37bdb1fdb927a8762567a7d314d7c6181a1fc63, artifact-evidence-3dc02ec99ec26d56034d111ef3a1d4d73b1c997c, artifact-evidence-1b52cd51778fa33e92a715f9f588b8830fc94031, artifact-evidence-6db70c09a00e8d4ba3811dd408bcca617d2264fa, ev-a6bfff68d12935a8f8f1c5579b638f63b72ac400]                | [unk-6aaec47758d76c5f40c7d135da75c7e56edd72e2, assessment-unknown-e9e49583cf5674ddbc2bed777edba0181fd4c5c4ef81c, assessment-unknown-09ba5c12f3b3116f06d30b7b7e211c68189e155298ced]                                                                                             | recommended |

## Model calls

Total model calls made: 15.

Completed model calls: 15.

Deterministically valid responses: 15.

Median completed-call latency: 31916.0 ms.

Maximum completed-call latency: 45710.3 ms.

Median output tokens: 3243.0.

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
| recommended           |     4 |
| viable                |    21 |
| rejected              |     3 |
| insufficient-evidence |    47 |

### Hard-resolution state totals

| State      | Count |
| ---------- | ----: |
| satisfied  |    46 |
| conflict   |     2 |
| unresolved |   162 |

### Declared catalog totals

| Catalog     | Count |
| ----------- | ----: |
| inferences  |   111 |
| claims      |    95 |
| unknowns    |   333 |
| limitations |     9 |
| conflicts   |     2 |

Fixtures with any satisfied hard resolution: 12.

Candidates with any satisfied hard resolution: 38.

Fixtures with a rejected disposition on a declared conflict: 2.

Candidates with a rejected disposition on a declared conflict: 2.

### Per-fixture diagnostic totals

| Fixture                                        | Response | Validation | Domain issues | Dispositions                                                 | Resolutions                            | Catalogs                                                          | Any satisfied | Rejected conflict |
| ---------------------------------------------- | -------- | ---------- | ------------: | ------------------------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------- | ------------- | ----------------- |
| authorization-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=7  | inferences=6, claims=6, unknowns=21, limitations=3, conflicts=0   | yes           | no                |
| authorization-express-container-prisma-redis   | captured | passed     |             0 | recommended=1, viable=1, rejected=1, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=2  | inferences=8, claims=11, unknowns=18, limitations=3, conflicts=0  | yes           | no                |
| authorization-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=17 | inferences=8, claims=5, unknowns=17, limitations=3, conflicts=0   | yes           | no                |
| audit-logging-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=2, rejected=0, insufficient-evidence=3 | satisfied=2, conflict=0, unresolved=13 | inferences=9, claims=7, unknowns=23, limitations=0, conflicts=0   | yes           | no                |
| audit-logging-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=2, conflict=0, unresolved=8  | inferences=4, claims=2, unknowns=20, limitations=0, conflicts=0   | yes           | no                |
| audit-logging-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25 | inferences=0, claims=0, unknowns=25, limitations=0, conflicts=0   | no            | no                |
| background-jobs-next-vercel-drizzle            | captured | passed     |             0 | recommended=0, viable=1, rejected=0, insufficient-evidence=4 | satisfied=0, conflict=0, unresolved=15 | inferences=4, claims=7, unknowns=28, limitations=0, conflicts=0   | no            | no                |
| background-jobs-express-container-prisma-redis | captured | passed     |             0 | recommended=0, viable=2, rejected=0, insufficient-evidence=3 | satisfied=6, conflict=0, unresolved=4  | inferences=10, claims=7, unknowns=19, limitations=0, conflicts=0  | yes           | no                |
| background-jobs-next-selfhosted-drizzle        | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=25 | inferences=3, claims=11, unknowns=31, limitations=0, conflicts=0  | no            | no                |
| rate-limiting-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=2  | inferences=6, claims=3, unknowns=19, limitations=0, conflicts=0   | yes           | no                |
| rate-limiting-express-container-prisma-redis   | captured | passed     |             0 | recommended=1, viable=1, rejected=0, insufficient-evidence=3 | satisfied=3, conflict=0, unresolved=2  | inferences=6, claims=3, unknowns=20, limitations=0, conflicts=0   | yes           | no                |
| rate-limiting-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=12 | inferences=6, claims=3, unknowns=23, limitations=0, conflicts=0   | yes           | no                |
| webhooks-next-vercel-drizzle                   | captured | passed     |             0 | recommended=0, viable=1, rejected=1, insufficient-evidence=3 | satisfied=6, conflict=1, unresolved=8  | inferences=10, claims=12, unknowns=24, limitations=0, conflicts=1 | yes           | yes               |
| webhooks-express-container-prisma-redis        | captured | passed     |             0 | recommended=1, viable=1, rejected=0, insufficient-evidence=3 | satisfied=6, conflict=0, unresolved=4  | inferences=14, claims=8, unknowns=21, limitations=0, conflicts=0  | yes           | no                |
| webhooks-next-selfhosted-drizzle               | captured | passed     |             0 | recommended=1, viable=0, rejected=1, insufficient-evidence=3 | satisfied=6, conflict=1, unresolved=18 | inferences=17, claims=10, unknowns=24, limitations=0, conflicts=1 | yes           | yes               |

## Failure categories

No failed calls.
