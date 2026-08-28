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
| authorization     |                      0 |           0 |                     1 |                   0 |         2 |      0 |
| audit-logging     |                      0 |           0 |                     1 |                   0 |         2 |      0 |
| background-jobs   |                      0 |           0 |                     0 |                   0 |         3 |      0 |
| rate-limiting     |                      0 |           0 |                     0 |                   0 |         3 |      0 |
| webhooks          |                      0 |           0 |                     1 |                   0 |         2 |      0 |

## Non-recommend outcomes

| Fixture                                      | Outcome               | Producing stage                     | Reason                               |
| -------------------------------------------- | --------------------- | ----------------------------------- | ------------------------------------ |
| authorization-next-selfhosted-drizzle        | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| audit-logging-express-container-prisma-redis | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| webhooks-next-selfhosted-drizzle             | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |

## Insufficient-evidence detail

| Fixture                                      | Unresolved hard evaluations per finalist | Artifact excerpt available per finalist |
| -------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| authorization-next-selfhosted-drizzle        | [2, 2, 3, 2, 2]                          | [yes, no, yes, yes, no]                 |
| audit-logging-express-container-prisma-redis | [2, 2, 2, 2, 2]                          | [yes, yes, yes, yes, yes]               |
| webhooks-next-selfhosted-drizzle             | [4, 4, 2, 3, 2]                          | [yes, yes, yes, yes, yes]               |

## Recommend detail

| Fixture                                        | Options returned | Eligible-lane options | Evidence-needed-lane options | Options with unverified constraints |
| ---------------------------------------------- | ---------------: | --------------------: | ---------------------------: | ----------------------------------: |
| authorization-next-vercel-drizzle              |                3 |                     3 |                            0 |                                   0 |
| authorization-express-container-prisma-redis   |                3 |                     3 |                            0 |                                   0 |
| audit-logging-next-vercel-drizzle              |                2 |                     0 |                            2 |                                   2 |
| audit-logging-next-selfhosted-drizzle          |                1 |                     0 |                            1 |                                   1 |
| background-jobs-next-vercel-drizzle            |                1 |                     0 |                            1 |                                   0 |
| background-jobs-express-container-prisma-redis |                2 |                     0 |                            2 |                                   0 |
| background-jobs-next-selfhosted-drizzle        |                1 |                     0 |                            1 |                                   1 |
| rate-limiting-next-vercel-drizzle              |                3 |                     0 |                            3 |                                   0 |
| rate-limiting-express-container-prisma-redis   |                3 |                     0 |                            3 |                                   0 |
| rate-limiting-next-selfhosted-drizzle          |                3 |                     0 |                            3 |                                   3 |
| webhooks-next-vercel-drizzle                   |                2 |                     0 |                            2 |                                   2 |
| webhooks-express-container-prisma-redis        |                2 |                     0 |                            2 |                                   0 |

### Recommended option detail

| Fixture                                        | Candidate ID                    | Lane            | Verification                     | Unverified constraints | Evidence references                                                                                                                                                                                                                                                                                                                                       | Material unknowns                                                                                                                                                                                                                                    | Disposition |
| ---------------------------------------------- | ------------------------------- | --------------- | -------------------------------- | ---------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| authorization-next-vercel-drizzle              | auth-warrant                    | eligible        | fully-verified                   |                      0 | [artifact-evidence-15ec3082b5a53d743c45ffc58cc9e681bb0f1386, artifact-evidence-baa8b2c9b46e0ce3aa7d86008e76de2eca5a1ad0, artifact-evidence-6198ffb38dc9fe222eeeedae3e68c622caa0f941, artifact-evidence-f5dd0e3ac03c3b6985b2e812f3a1953725af9861, artifact-evidence-ab7fae13da61250da1aef7bcce2bc04d13fd6988]                                              | []                                                                                                                                                                                                                                                   | recommended |
| authorization-next-vercel-drizzle              | auth-permify                    | eligible        | fully-verified                   |                      0 | [artifact-evidence-f6e4bc2904295752e213fb8873d54395795658fb, artifact-evidence-39d20138ae4700787fa7edca5b3b4b7bc37b622b, artifact-evidence-558f3a6bd5b8806b8acdeaee7da2b8037e62ea0e, artifact-evidence-1daa2f654c8fd4f81fb914196db752bbf2fc95be]                                                                                                          | [unk-654ad6aa8dd57cba229dc6e5e77132a669cb0067, assessment-unknown-a2a37295a573cf5b820e86e4a18d4df1fe81b83d98d33]                                                                                                                                     | viable      |
| authorization-next-vercel-drizzle              | auth-casbin-node-casbin         | eligible        | fully-verified                   |                      0 | [artifact-evidence-2b4e77b1b2afda2962385aa8e397610f26a5691e, artifact-evidence-79da54811c38e62ff59d06b50c2b7d9990aec596, ev-305ec9770bf50a186100cbca75e496d46918c29f, ev-9fbd68343089b0eb99e551fec718aedac9d8d5f7, ev-a1d189bf726d793724b034fd56f98dab56312038]                                                                                           | [unk-8538c6db70ce6362931c72431ccbfe42c9bf77f7, unk-a15707136190e56f81c748db2b60f9e00dc5000f, assessment-unknown-8d473194a0c81c91a3e987b8b84fd31410812e5024fe4]                                                                                       | viable      |
| authorization-express-container-prisma-redis   | auth-warrant                    | eligible        | fully-verified                   |                      0 | [artifact-evidence-15ec3082b5a53d743c45ffc58cc9e681bb0f1386, artifact-evidence-baa8b2c9b46e0ce3aa7d86008e76de2eca5a1ad0, artifact-evidence-6198ffb38dc9fe222eeeedae3e68c622caa0f941, artifact-evidence-f5dd0e3ac03c3b6985b2e812f3a1953725af9861, artifact-evidence-ab7fae13da61250da1aef7bcce2bc04d13fd6988]                                              | [assessment-unknown-8b47fdd34a1206614a478ff0db20c83b07cba0ad4df39]                                                                                                                                                                                   | viable      |
| authorization-express-container-prisma-redis   | auth-permify                    | eligible        | fully-verified                   |                      0 | [artifact-evidence-f6e4bc2904295752e213fb8873d54395795658fb, artifact-evidence-558f3a6bd5b8806b8acdeaee7da2b8037e62ea0e, artifact-evidence-1daa2f654c8fd4f81fb914196db752bbf2fc95be, artifact-evidence-931465f54d3deccfe70457d9d657e3d81e34fdcf]                                                                                                          | []                                                                                                                                                                                                                                                   | viable      |
| authorization-express-container-prisma-redis   | auth-casbin-node-casbin         | eligible        | fully-verified                   |                      0 | [ev-18d295b95746777129ec369717b484969163fbca, ev-305ec9770bf50a186100cbca75e496d46918c29f, artifact-evidence-2b4e77b1b2afda2962385aa8e397610f26a5691e, artifact-evidence-79da54811c38e62ff59d06b50c2b7d9990aec596, ev-a1d189bf726d793724b034fd56f98dab56312038]                                                                                           | [assessment-unknown-3bd84d695e995eae586bdf551e0c3b76613d387a97af4]                                                                                                                                                                                   | viable      |
| audit-logging-next-vercel-drizzle              | audit-pino-http                 | evidence-needed | unverified-prohibited-constraint |                      1 | [ev-34499e639679b24b7bc271cdaaf187be0e42ad4c, artifact-evidence-4bc7b0c7a1e3f4b625446b50dc08ab5da8799e57, artifact-evidence-20f09adad3d08d9618f1707af53ce5705edf5542, artifact-evidence-17bc17113ad627384013010f1acca45e8c41e539]                                                                                                                         | [assessment-unknown-846e7f94c517c954d97c167e8b047edf1abf0c21e7bf4, assessment-unknown-ae67609ca444bb10605bd2a189186090bb90697930095]                                                                                                                 | viable      |
| audit-logging-next-vercel-drizzle              | audit-roarr                     | evidence-needed | unverified-prohibited-constraint |                      1 | [ev-e281aa00f5e9ac8db0ddf7d62bc8dacd2dd3bd60, artifact-evidence-15efffefabaa1e3387218002daa8e9a0ea911119, artifact-evidence-83f13510eb1011d211d01ab996dcfd68c9b513ca, artifact-evidence-523b333c536e89bf44c86637bf9dc50db9f4aade, artifact-evidence-152c7aeafca85693ed6deb1b4e8e0a0e55f61e83, artifact-evidence-7b9b3ae6aba486ec8c3b4108a72995f20986723b] | [assessment-unknown-b6ba9da7bab78692e218b6748cc3b8d35c6f5a39f6565, assessment-unknown-c30689568bb27bc9dd62da6dd1e4c67ae6b3be4f14ee3, assessment-unknown-69fcc77e4f3544aacc27146532f3aa8b88684e30a0787]                                               | viable      |
| audit-logging-next-selfhosted-drizzle          | audit-roarr                     | evidence-needed | unverified-prohibited-constraint |                      3 | [artifact-evidence-15efffefabaa1e3387218002daa8e9a0ea911119, artifact-evidence-83f13510eb1011d211d01ab996dcfd68c9b513ca, artifact-evidence-7b9b3ae6aba486ec8c3b4108a72995f20986723b, artifact-evidence-7f5f98e66943d4efcf57b7cd6f7c39174765e757, artifact-evidence-6b206dda61ee1e3d79a2538c11c526db7a64b315]                                              | [unk-96429b1f165a68a1b782b26d115e499777ee69b3, assessment-unknown-44b61a3da0924c676fdf5ae46b3afb86ce7639fb57e84, assessment-unknown-473624b55002fb8cd0e1037ecf4849c9469011f3e6380, assessment-unknown-ce07262f95c0a25d10171f51a8ab2a7bd488351ad78cf] | viable      |
| background-jobs-next-vercel-drizzle            | jobs-agenda                     | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-56554adc9e54719c94ff48de3f5fa8ca9005b9ba, artifact-evidence-312be5ce4f6724e6dba8e0eef207b994af4a1e18, artifact-evidence-e35b1a3d47dce5e5a6c31eb5175f29f1befcd3c0, artifact-evidence-94e397c1e6fed20a15c05248e890fa296f1dd79c, ev-1e141696eca7fcc827b5439b594f017ac6bdd775]                                                             | [assessment-unknown-aef65d8b0a07b7951cd61a163be7ef47428bfa5e1091b]                                                                                                                                                                                   | viable      |
| background-jobs-express-container-prisma-redis | jobs-agenda                     | evidence-needed | fully-verified                   |                      0 | [ev-1e141696eca7fcc827b5439b594f017ac6bdd775, artifact-evidence-56554adc9e54719c94ff48de3f5fa8ca9005b9ba, artifact-evidence-312be5ce4f6724e6dba8e0eef207b994af4a1e18, artifact-evidence-e35b1a3d47dce5e5a6c31eb5175f29f1befcd3c0, artifact-evidence-94e397c1e6fed20a15c05248e890fa296f1dd79c]                                                             | []                                                                                                                                                                                                                                                   | recommended |
| background-jobs-express-container-prisma-redis | jobs-asynq                      | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-30de454f71f4aa21fc53a5ad621d12cda5b35f82, artifact-evidence-008b6a3d08110826c9ebc47fb8e944a79ed14134, artifact-evidence-33bcb1a959705a6dfba7769d4152e33e7fb42962]                                                                                                                                                                      | [unk-84ef623fc3c0bc281d49e96672d0c72c59b54660, assessment-unknown-b668ab2f1752df00d779b963deef66d6934dcf441a340]                                                                                                                                     | viable      |
| background-jobs-next-selfhosted-drizzle        | jobs-agenda                     | evidence-needed | unverified-prohibited-constraint |                      2 | [artifact-evidence-56554adc9e54719c94ff48de3f5fa8ca9005b9ba, artifact-evidence-312be5ce4f6724e6dba8e0eef207b994af4a1e18, artifact-evidence-e35b1a3d47dce5e5a6c31eb5175f29f1befcd3c0, artifact-evidence-94e397c1e6fed20a15c05248e890fa296f1dd79c]                                                                                                          | [unk-7c270317506bc956f2a2daf3ccee17d9de2e13d4, assessment-unknown-a16ec4f0ab7e4e83ef828798ee9ca62c4fa7671bb8a1f, assessment-unknown-192e8aa4d023a43f3af51c1cd1ec3bbeda0357237ba87]                                                                   | viable      |
| rate-limiting-next-vercel-drizzle              | rate-node-rate-limiter-flexible | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf, artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f, ev-7ad2a98d02e2d3b3985452cfb0ba2cee08f891c2]                                                                                                                                                                                     | [unk-99493d5e13f3af0e2719524aafafe3e0368f118c, assessment-unknown-6b643618cf2da798b5a1e37a9aab63694e49264a463cd, assessment-unknown-a40054cd556d4ca9747f9610cd6929cc94923b4e33e27]                                                                   | viable      |
| rate-limiting-next-vercel-drizzle              | rate-express-rate-limit         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-7ed805185937addaea4616e1cf9932d21ad8c523, artifact-evidence-8f92b4f0236d58bd4ae404d87cd05bd0b4ae9b47]                                                                                                                                                                                                                                  | [unk-70b920f4c31daf52dca790a9d2ee57d5e054c96c, assessment-unknown-0168a582b59a188436a153c370b373adc32e702bb6b89, assessment-unknown-363a2ffe1ac0c39cfe8a9307edcc0f619076ded354e2e]                                                                   | viable      |
| rate-limiting-next-vercel-drizzle              | rate-fastify-rate-limit         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-5f3e183b5a6498a5891ed8368e61163754f003b6, artifact-evidence-0550fa0163cd72ff7a0bc94b7b98119054f64cef]                                                                                                                                                                                                                                  | [unk-0921899a79a2427f2f10c448f1b4595167572a34, assessment-unknown-f10a127fc1c3e53b262384a5ab5723bc099314aa0c5e1, assessment-unknown-e1a82ad4e9f7dfc2736689f124114d51d418fa28a0ddb]                                                                   | viable      |
| rate-limiting-express-container-prisma-redis   | rate-node-rate-limiter-flexible | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf, artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f]                                                                                                                                                                                                                                  | [unk-99493d5e13f3af0e2719524aafafe3e0368f118c, assessment-unknown-e122a6b0107fa8797f86a7da0f4a94760cb52a0354e2f]                                                                                                                                     | recommended |
| rate-limiting-express-container-prisma-redis   | rate-express-rate-limit         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-7ed805185937addaea4616e1cf9932d21ad8c523, artifact-evidence-8f92b4f0236d58bd4ae404d87cd05bd0b4ae9b47]                                                                                                                                                                                                                                  | [unk-70b920f4c31daf52dca790a9d2ee57d5e054c96c, assessment-unknown-2532758f729d02cfc81bbd7d2d74f2da8e0adc0be94a8]                                                                                                                                     | viable      |
| rate-limiting-express-container-prisma-redis   | rate-fastify-rate-limit         | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-5f3e183b5a6498a5891ed8368e61163754f003b6, artifact-evidence-0550fa0163cd72ff7a0bc94b7b98119054f64cef]                                                                                                                                                                                                                                  | [unk-0921899a79a2427f2f10c448f1b4595167572a34, assessment-unknown-cd10518b5f494e24634d095fc557e5b09a705f7cbddce]                                                                                                                                     | viable      |
| rate-limiting-next-selfhosted-drizzle          | rate-node-rate-limiter-flexible | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-d9b1814493df46d026dba46c52faaa09fd475cbf, artifact-evidence-1d9adfe7b9658aa646d4f4fa3765d56f9fd0481f]                                                                                                                                                                                                                                  | [assessment-unknown-9482e8622d3912ca5547a8788b01cff1485aed5459be9, assessment-unknown-ab3c30bb3efa8613d75eb8ce89b0978b65096f085bf9a, assessment-unknown-1ac2bf3efbecade4afcf6a87606f80163d4234ca8b4c0]                                               | viable      |
| rate-limiting-next-selfhosted-drizzle          | rate-fastify-rate-limit         | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-5f3e183b5a6498a5891ed8368e61163754f003b6, artifact-evidence-0550fa0163cd72ff7a0bc94b7b98119054f64cef, artifact-evidence-f5f48ad91beaf7d2152f5bbcf116608d41890241]                                                                                                                                                                      | [assessment-unknown-a78e9318c755c781a86bf937cc520415ca66d80b936c3, assessment-unknown-f22b4b75ce79612233adaf399637809888c307a60ed5f, assessment-unknown-21ac4f2c8673d5d1a8abce089dce5a1810403bbb4cb0f]                                               | viable      |
| rate-limiting-next-selfhosted-drizzle          | rate-express-rate-limit         | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-7ed805185937addaea4616e1cf9932d21ad8c523, artifact-evidence-8f92b4f0236d58bd4ae404d87cd05bd0b4ae9b47, artifact-evidence-a3e40ebbd553866fd69ac19fb35cf5da3d2a2106]                                                                                                                                                                      | [assessment-unknown-fc349fdec1e23d57b69c2f933e15ea70d1bb4e1ad38a2, assessment-unknown-ce7d966a0c900339dcc993d7772b2e81571f83b5f47d7, assessment-unknown-6bd4095dc639fe43051a6037d692c555a59759c4cbb68]                                               | viable      |
| webhooks-next-vercel-drizzle                   | webhook-standard-webhooks       | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-cd8aac232ede6e8d84351d9f5c345b2e150feabf, artifact-evidence-8695e56e7c55c479c96421dad6aa3a2ecdd9923c, artifact-evidence-4c7a40d0924b107c2fe3bfe34c32f0fecbc20a0e, artifact-evidence-91d8b063062d1c85710bc46447be661e3dd903fc, artifact-evidence-ccdc2415c9875d0381cee6eb2f8149256deccae7]                                              | [assessment-unknown-313133b33e68337712d05983db2ac3d4f14e2b29bf804, assessment-unknown-adb403730adb3efd272ce7464ba4c20b3e953f2cfc60f]                                                                                                                 | viable      |
| webhooks-next-vercel-drizzle                   | webhook-svix                    | evidence-needed | unverified-prohibited-constraint |                      1 | [artifact-evidence-4a56fcf68449989a4e6553a9307d903d31096902, artifact-evidence-cbcff9ffadf091637608930d5f8748a19c83709b, artifact-evidence-7ecd7dca837ceced15c34c9b5cae68584a88511a, artifact-evidence-f64a2c0048e8ce409d7ac99b9e94c57a6ee00604, artifact-evidence-553905de28ec16090ded973a6b75eb64cd29058b]                                              | [unk-88ed064aeaaa32dffb33cb8f026a5f6889c0d854, assessment-unknown-c7262ca2f7e6d123be7ad2ba45ffa3726348ed4253c42, assessment-unknown-b7f03c9b3b4290c0e9aa8d0b7cb935c84a63fbb2adf5d]                                                                   | viable      |
| webhooks-express-container-prisma-redis        | webhook-svix                    | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-4a56fcf68449989a4e6553a9307d903d31096902, artifact-evidence-cbcff9ffadf091637608930d5f8748a19c83709b, artifact-evidence-7ecd7dca837ceced15c34c9b5cae68584a88511a, ev-0501c8720de8ac1e80472e272cd251650d346dd2]                                                                                                                         | [assessment-unknown-8c06b72f6b4d5269adc8dbdbb91c1ebe6bb9d6ecbd873]                                                                                                                                                                                   | recommended |
| webhooks-express-container-prisma-redis        | webhook-adnanh                  | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-9f1184779a8966ef4f99d85ccd16cf71cdc4ec13, artifact-evidence-c7ac0cbedef93bf65380934970e847f41718353e, artifact-evidence-204191e0bf025ba7210d1d52af8d63b1bd4c2217]                                                                                                                                                                      | [assessment-unknown-5467075444f38fbe3b036eaec450bfc8eb243cb2eefbf]                                                                                                                                                                                   | viable      |

## Model calls

Total model calls made: 15.

Completed model calls: 15.

Deterministically valid responses: 15.

Median completed-call latency: 26894.9 ms.

Maximum completed-call latency: 40826.6 ms.

Median output tokens: 3253.0.

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
| viable                |    22 |
| rejected              |     0 |
| insufficient-evidence |    49 |

### Hard-resolution state totals

| State      | Count |
| ---------- | ----: |
| satisfied  |    53 |
| conflict   |     1 |
| unresolved |   122 |

### Declared catalog totals

| Catalog     | Count |
| ----------- | ----: |
| inferences  |   121 |
| claims      |   103 |
| unknowns    |   306 |
| limitations |     8 |
| conflicts   |     1 |

Fixtures with any satisfied hard resolution: 11.

Candidates with any satisfied hard resolution: 35.

Fixtures with a rejected disposition on a declared conflict: 0.

Candidates with a rejected disposition on a declared conflict: 0.

### Per-fixture diagnostic totals

| Fixture                                        | Response | Validation | Domain issues | Dispositions                                                 | Resolutions                            | Catalogs                                                          | Any satisfied | Rejected conflict |
| ---------------------------------------------- | -------- | ---------- | ------------: | ------------------------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------- | ------------- | ----------------- |
| authorization-next-vercel-drizzle              | captured | passed     |             0 | recommended=1, viable=2, rejected=0, insufficient-evidence=2 | satisfied=0, conflict=0, unresolved=0  | inferences=8, claims=10, unknowns=15, limitations=3, conflicts=0  | no            | no                |
| authorization-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=0, conflict=0, unresolved=0  | inferences=5, claims=7, unknowns=15, limitations=3, conflicts=0   | no            | no                |
| authorization-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=11 | inferences=0, claims=4, unknowns=20, limitations=2, conflicts=0   | no            | no                |
| audit-logging-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=2, rejected=0, insufficient-evidence=3 | satisfied=4, conflict=0, unresolved=11 | inferences=8, claims=12, unknowns=23, limitations=0, conflicts=0  | yes           | no                |
| audit-logging-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=10 | inferences=0, claims=5, unknowns=15, limitations=0, conflicts=0   | no            | no                |
| audit-logging-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=1, rejected=0, insufficient-evidence=4 | satisfied=3, conflict=0, unresolved=22 | inferences=4, claims=8, unknowns=26, limitations=0, conflicts=0   | yes           | no                |
| background-jobs-next-vercel-drizzle            | captured | passed     |             0 | recommended=0, viable=1, rejected=0, insufficient-evidence=4 | satisfied=4, conflict=0, unresolved=6  | inferences=6, claims=4, unknowns=18, limitations=0, conflicts=0   | yes           | no                |
| background-jobs-express-container-prisma-redis | captured | passed     |             0 | recommended=1, viable=1, rejected=0, insufficient-evidence=3 | satisfied=5, conflict=0, unresolved=5  | inferences=9, claims=5, unknowns=14, limitations=0, conflicts=0   | yes           | no                |
| background-jobs-next-selfhosted-drizzle        | captured | passed     |             0 | recommended=0, viable=1, rejected=0, insufficient-evidence=4 | satisfied=4, conflict=0, unresolved=16 | inferences=8, claims=4, unknowns=27, limitations=0, conflicts=0   | yes           | no                |
| rate-limiting-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=2  | inferences=7, claims=4, unknowns=22, limitations=0, conflicts=0   | yes           | no                |
| rate-limiting-express-container-prisma-redis   | captured | passed     |             0 | recommended=1, viable=2, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=2  | inferences=7, claims=4, unknowns=20, limitations=0, conflicts=0   | yes           | no                |
| rate-limiting-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=6, conflict=0, unresolved=9  | inferences=12, claims=6, unknowns=24, limitations=0, conflicts=0  | yes           | no                |
| webhooks-next-vercel-drizzle                   | captured | passed     |             0 | recommended=0, viable=2, rejected=0, insufficient-evidence=3 | satisfied=6, conflict=0, unresolved=9  | inferences=13, claims=12, unknowns=24, limitations=0, conflicts=0 | yes           | no                |
| webhooks-express-container-prisma-redis        | captured | passed     |             0 | recommended=1, viable=1, rejected=0, insufficient-evidence=3 | satisfied=6, conflict=0, unresolved=4  | inferences=13, claims=7, unknowns=21, limitations=0, conflicts=0  | yes           | no                |
| webhooks-next-selfhosted-drizzle               | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=9, conflict=1, unresolved=15 | inferences=21, claims=11, unknowns=22, limitations=0, conflicts=1 | yes           | no                |

## Failure categories

No failed calls.
