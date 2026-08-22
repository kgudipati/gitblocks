# Outcome baseline v1

Reproduce from the repository root with `pnpm outcome:baseline:v1`.

This report contains no request prose, candidate display names, or model output text.

## Aggregate outcome counts

| Outcome                | Count |
| ---------------------- | ----: |
| clarification-required |     0 |
| unsupported            |     0 |
| insufficient-evidence  |     1 |
| no-viable-candidate    |     0 |
| recommend              |     8 |
| failed                 |     6 |

## Outcome counts by capability family

| Capability family | clarification-required | unsupported | insufficient-evidence | no-viable-candidate | recommend | failed |
| ----------------- | ---------------------: | ----------: | --------------------: | ------------------: | --------: | -----: |
| authorization     |                      0 |           0 |                     0 |                   0 |         2 |      1 |
| audit-logging     |                      0 |           0 |                     1 |                   0 |         2 |      0 |
| background-jobs   |                      0 |           0 |                     0 |                   0 |         1 |      2 |
| rate-limiting     |                      0 |           0 |                     0 |                   0 |         0 |      3 |
| webhooks          |                      0 |           0 |                     0 |                   0 |         3 |      0 |

## Non-recommend outcomes

| Fixture                                        | Outcome               | Producing stage                     | Reason                               |
| ---------------------------------------------- | --------------------- | ----------------------------------- | ------------------------------------ |
| authorization-next-vercel-drizzle              | failed                | deterministic assessment validation | invalid-target-fit-response          |
| audit-logging-next-vercel-drizzle              | insufficient-evidence | deterministic assessment validation | fit-assessment-insufficient-evidence |
| background-jobs-express-container-prisma-redis | failed                | deterministic assessment validation | invalid-target-fit-response          |
| background-jobs-next-selfhosted-drizzle        | failed                | deterministic assessment validation | invalid-target-fit-response          |
| rate-limiting-next-vercel-drizzle              | failed                | deterministic assessment validation | invalid-target-fit-response          |
| rate-limiting-express-container-prisma-redis   | failed                | deterministic assessment validation | invalid-target-fit-response          |
| rate-limiting-next-selfhosted-drizzle          | failed                | deterministic assessment validation | invalid-target-fit-response          |

## Insufficient-evidence detail

| Fixture                           | Unresolved hard evaluations per finalist | Artifact excerpt available per finalist |
| --------------------------------- | ---------------------------------------- | --------------------------------------- |
| audit-logging-next-vercel-drizzle | [3, 3, 3, 3, 3]                          | [yes, yes, yes, yes, yes]               |

## Recommend detail

| Fixture                                      | Options returned | Eligible-lane options | Evidence-needed-lane options | Options with unverified constraints |
| -------------------------------------------- | ---------------: | --------------------: | ---------------------------: | ----------------------------------: |
| authorization-express-container-prisma-redis |                3 |                     0 |                            3 |                                   0 |
| authorization-next-selfhosted-drizzle        |                3 |                     0 |                            3 |                                   3 |
| audit-logging-express-container-prisma-redis |                3 |                     0 |                            3 |                                   0 |
| audit-logging-next-selfhosted-drizzle        |                3 |                     0 |                            3 |                                   3 |
| background-jobs-next-vercel-drizzle          |                3 |                     0 |                            3 |                                   3 |
| webhooks-next-vercel-drizzle                 |                1 |                     0 |                            1 |                                   1 |
| webhooks-express-container-prisma-redis      |                3 |                     0 |                            3 |                                   1 |
| webhooks-next-selfhosted-drizzle             |                3 |                     0 |                            3 |                                   3 |

### Recommended option detail

| Fixture                                      | Candidate ID              | Lane            | Verification                     | Unverified constraints | Evidence references                                                                                                                                                                                                                                                                                                                                                                                                   | Material unknowns                                                                                                                                                                                                                                                              | Disposition |
| -------------------------------------------- | ------------------------- | --------------- | -------------------------------- | ---------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| authorization-express-container-prisma-redis | auth-casbin-casbin        | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-15de1d65cba130055ca4e3a3bcb541f99793cc97, artifact-evidence-c558152924def1d1797f369e610759da05fd34e9, ev-c3bb8ffe2606edb7ef5c0f6c8bb6ab748351d65f]                                                                                                                                                                                                                                                 | [unk-acb2a8b67b802d4a3290bb0e0c7e0b5c3361201e, unk-f473d94aba03390e6f9426489c7e9330e6c607eb, assessment-unknown-eeed4107108f9bad5f759bab13ab63e849bc472a59dc1, assessment-unknown-1d4859907011dd3976194d006dbfb4a4e9e55b3f46274]                                               | recommended |
| authorization-express-container-prisma-redis | auth-casbin-node-casbin   | evidence-needed | fully-verified                   |                      0 | [ev-9fbd68343089b0eb99e551fec718aedac9d8d5f7, artifact-evidence-1043e012fa62346177938ea4b1f627ecff67b28e, artifact-evidence-37a5d83a039e2b54ce89d28ce0092a0c8362fea2, ev-a1d189bf726d793724b034fd56f98dab56312038]                                                                                                                                                                                                    | [unk-2d55a7fa4fbbd58b4817cc8749c5a5e3a7c91a06, unk-8538c6db70ce6362931c72431ccbfe42c9bf77f7, unk-a15707136190e56f81c748db2b60f9e00dc5000f, assessment-unknown-41c5d2ca7ee904396d471863bb8e82115c38909fa6cc4, assessment-unknown-16a0ab379c76e3bf9ef7fe1b70aadfddbe0cf8bdb1c25] | recommended |
| authorization-express-container-prisma-redis | auth-casbin-casbin-js     | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-2e07e70680280f50531209d25a663a57c20678bf, artifact-evidence-f24f6304538f657127d9c525698d485a38c937df, ev-cd82e507ca536887819663632baa5fc3c7593e3d, ev-20fffa0efde9b27f20d7fc34c87a634799f60980]                                                                                                                                                                                                    | [unk-2c2b6c80edfb2e5ce987787c768f514f16313672, unk-4de39ec7a1818000f9a00e8cec89003c481f589a, assessment-unknown-d3f0de0d1c761b65e93715ca916de6fae5c4435dfc0f9]                                                                                                                 | viable      |
| authorization-next-selfhosted-drizzle        | auth-casbin-node-casbin   | evidence-needed | unverified-prohibited-constraint |                      3 | [artifact-evidence-1043e012fa62346177938ea4b1f627ecff67b28e, artifact-evidence-37a5d83a039e2b54ce89d28ce0092a0c8362fea2, artifact-evidence-3a7c582175d3307927f9ce8d8af8dcac9e356e7f, ev-9fbd68343089b0eb99e551fec718aedac9d8d5f7, ev-a1d189bf726d793724b034fd56f98dab56312038]                                                                                                                                        | [unk-2d55a7fa4fbbd58b4817cc8749c5a5e3a7c91a06, unk-8538c6db70ce6362931c72431ccbfe42c9bf77f7, unk-a15707136190e56f81c748db2b60f9e00dc5000f, assessment-unknown-08c341498b40f1c9774c690a36374ca3f5b97249e3c94]                                                                   | viable      |
| authorization-next-selfhosted-drizzle        | auth-casbin-casbin        | evidence-needed | unverified-prohibited-constraint |                      3 | [artifact-evidence-15de1d65cba130055ca4e3a3bcb541f99793cc97, artifact-evidence-c558152924def1d1797f369e610759da05fd34e9, artifact-evidence-6daafdac6c2eecbbc33249f1d440ba9e333a510c, artifact-evidence-90c510271d95e3da473d55d73117d860286d8761, ev-c3bb8ffe2606edb7ef5c0f6c8bb6ab748351d65f, artifact-evidence-05159ffc0466aa4b7a5c8dd400b1cae2d726057c, artifact-evidence-71bc949203d7ce1d5d97c100515951510575c1e7] | [unk-acb2a8b67b802d4a3290bb0e0c7e0b5c3361201e, unk-f473d94aba03390e6f9426489c7e9330e6c607eb, assessment-unknown-a0e16dde99692072b50c323f0ccf5a64c20e4a1974b42]                                                                                                                 | viable      |
| authorization-next-selfhosted-drizzle        | auth-openfga              | evidence-needed | unverified-prohibited-constraint |                      3 | [artifact-evidence-d04c535d86c32d571bca781c624f1df44581bddd, artifact-evidence-6d6d373a6dfeca08bb7ce4e948038172b89c4fda, artifact-evidence-a198452efd38edb31ee124991c6f2c46afc1991b, artifact-evidence-45c87807f5affa02da4b88366439582aa5118b28, artifact-evidence-47efec7932f9a23972e6cf8c22f46e12e4332520]                                                                                                          | [unk-42602374f893ae88c563304c394df41db5a6ac9a, unk-cd115902beb20bb85cb06065fe44e3b3aceeef0f, assessment-unknown-6f42059470002c2459b2c5f3e778673830e6bf2228576, assessment-unknown-36cf906b7784f09d587e0c773ece5b677a302eed8c601]                                               | viable      |
| audit-logging-express-container-prisma-redis | audit-pino                | evidence-needed | fully-verified                   |                      0 | [ev-b0b7d0cf70e7b4dd495a1d26019fb32af9c5cb89, artifact-evidence-68b74ba527eab23e92e8b4f1900dc10523c0ff79, artifact-evidence-dfa97d7780ed1b730683c65b8ebe1e3038ac1c51]                                                                                                                                                                                                                                                 | [unk-24b46d26faa1137cb97f64caabaf483699831650, unk-5e77b0972014d79bfa331dd8e63a251667f5b648, unk-f57d0ee30536bb835ce26a2536121d09f38222b3, assessment-unknown-93368beca4554bb1c4de043a9d76a222d1f8453a83556]                                                                   | viable      |
| audit-logging-express-container-prisma-redis | audit-pino-http           | evidence-needed | fully-verified                   |                      0 | [ev-34499e639679b24b7bc271cdaaf187be0e42ad4c, artifact-evidence-4bc7b0c7a1e3f4b625446b50dc08ab5da8799e57, artifact-evidence-20f09adad3d08d9618f1707af53ce5705edf5542, artifact-evidence-17bc17113ad627384013010f1acca45e8c41e539]                                                                                                                                                                                     | [unk-621b53653c7949d48923237c857518841cfbf91c, unk-c1c957ff829e614f707a9997c2b43fe642b915e8, unk-edb8f2bcab7a3acb55106fe44cf48387e1fc9f3a, assessment-unknown-6346bbf5df8f9c4587ee02b170afc84461caa0f24dd33]                                                                   | viable      |
| audit-logging-express-container-prisma-redis | audit-roarr               | evidence-needed | fully-verified                   |                      0 | [ev-e281aa00f5e9ac8db0ddf7d62bc8dacd2dd3bd60, artifact-evidence-15efffefabaa1e3387218002daa8e9a0ea911119, artifact-evidence-83f13510eb1011d211d01ab996dcfd68c9b513ca, artifact-evidence-523b333c536e89bf44c86637bf9dc50db9f4aade, artifact-evidence-152c7aeafca85693ed6deb1b4e8e0a0e55f61e83]                                                                                                                         | [unk-7dfdcea39c5ab3afa6cb7f4838027364efbad658, unk-96429b1f165a68a1b782b26d115e499777ee69b3, unk-f7c6049af341cd5bd8f98b7cb3e93fd34b608d12, assessment-unknown-01f399d7505bc40916f626f3132d92279759cccc6ebe5]                                                                   | viable      |
| audit-logging-next-selfhosted-drizzle        | audit-pgaudit             | evidence-needed | unverified-prohibited-constraint |                      5 | [artifact-evidence-f726ea31b11064717ac255574cab69979f1cf150, artifact-evidence-067ce4030fe1cb81fd80cc8770c4e4aed3719da1]                                                                                                                                                                                                                                                                                              | [unk-48c3890bf73b1e05fab1d74acc38a60470b2f7d3, unk-8ebb881a15b5f33f48e163d24e2a71436f746ed2, unk-c867cb1ac2526e15cde7f414f2dc5007fd4aca2d, assessment-unknown-8cd2201d6564f84c0e0833e338189e7c592a8e49071a3, assessment-unknown-c310ff7ca10ab334a52b86b7456800a150f01d0c0a102] | recommended |
| audit-logging-next-selfhosted-drizzle        | audit-pino                | evidence-needed | unverified-prohibited-constraint |                      5 | [artifact-evidence-7dbc2360632bf789e1b3ef22794ae70a4013f32f, artifact-evidence-e4aa72bf8ba8b04404d0d690074602ab76fe51c6, ev-b0b7d0cf70e7b4dd495a1d26019fb32af9c5cb89]                                                                                                                                                                                                                                                 | [unk-24b46d26faa1137cb97f64caabaf483699831650, unk-5e77b0972014d79bfa331dd8e63a251667f5b648, unk-f57d0ee30536bb835ce26a2536121d09f38222b3, assessment-unknown-03ced23bd0d6b67a81f683d32ecd0c44a61efd2c40690, assessment-unknown-863e392d02015ca5f81f0132cbe32e16cb9a35da88e8e] | viable      |
| audit-logging-next-selfhosted-drizzle        | audit-pino-http           | evidence-needed | unverified-prohibited-constraint |                      5 | [artifact-evidence-4bc7b0c7a1e3f4b625446b50dc08ab5da8799e57, artifact-evidence-20f09adad3d08d9618f1707af53ce5705edf5542, artifact-evidence-17bc17113ad627384013010f1acca45e8c41e539, ev-34499e639679b24b7bc271cdaaf187be0e42ad4c]                                                                                                                                                                                     | [unk-621b53653c7949d48923237c857518841cfbf91c, unk-c1c957ff829e614f707a9997c2b43fe642b915e8, unk-edb8f2bcab7a3acb55106fe44cf48387e1fc9f3a, assessment-unknown-595cb9b748c3066248c68e0f5457412b64569c97c2d57, assessment-unknown-9fef8f187f76ca5e011d6a1e979c85bd74ba6209c3607] | viable      |
| background-jobs-next-vercel-drizzle          | jobs-bree                 | evidence-needed | partially-verified               |                      1 | [artifact-evidence-c981050c32de4e0bc08fff7f985b0e07ef4a4dfb, artifact-evidence-d9178273e14ce0c3bd96f0cb5ae72d865902f734, artifact-evidence-ea2c0738711d9471b749254bd0a1957013de9a3b, ev-07859782479a4bfc96c58d062ae3736fd12ad103]                                                                                                                                                                                     | [unk-5002e38b69ff11c75392653a5384284d95c8b345, unk-85bd3430c4f04125f65a10e6d1570ed478229460, assessment-unknown-99f9f3a21550fe5aea77a2ddb78a28092cd0e444e2699]                                                                                                                 | viable      |
| background-jobs-next-vercel-drizzle          | jobs-river                | evidence-needed | unverified-prohibited-constraint |                      2 | [artifact-evidence-5e1ce8a573850614f2cdf05f42913963164366b8, artifact-evidence-5756854bedff5b60125257b6396cadc9760a93f5]                                                                                                                                                                                                                                                                                              | [unk-02ec027f059d00ff796a408cfb9a0ef6bbafc618, unk-bb8c7565b9165580eb7774e873a4bcc1077a433e, assessment-unknown-c63a37dce98dc3c5ff87b95493f1193e86ed14a29869a]                                                                                                                 | viable      |
| background-jobs-next-vercel-drizzle          | jobs-graphile-worker      | evidence-needed | unverified-prohibited-constraint |                      2 | [ev-9e2f8e1356406b00504bd7544f9536282d5253a9, artifact-evidence-0d77f4567a3cce964d4a7fbb51c0d3c90eab4aa9, artifact-evidence-01393682d01840360b97b7172a7301a640d413d2]                                                                                                                                                                                                                                                 | [unk-497a52f3e68301c67ddf4367aa906c3046bd538e, unk-75bf9d56c9bbaa7e40e08e15a77ab7851167c388, unk-763bb6beb7f0ccb41f04ef2cb8ebc5ed3f9edbe7, unk-e05da4e19a59a24627241990a15e7287d540d0c5, assessment-unknown-df1d657f18ea5d83fcc75038700b9e4cfe583beb9b129]                     | viable      |
| webhooks-next-vercel-drizzle                 | webhook-hook0             | evidence-needed | unverified-prohibited-constraint |                      2 | [artifact-evidence-cc910bbd588debeb7f983c1565aa6b5a34505024, artifact-evidence-6d354ca567ddab258d4da3f9d15c182b17e6be09, artifact-evidence-becd5a78fa819f44d1480a767bd7c928ab0a57fe]                                                                                                                                                                                                                                  | [unk-1c953f9001ecbf4636000d1235acc3500fe708f8, unk-2fa56d44b31278452756ac4e1518726edb396c7d, unk-93b9e924bc4ecaee6528ef9183c2c7fd002d4838, assessment-unknown-ede4c80e338a95b43d2e58f3b21c53e0827d5c4b378fe, assessment-unknown-10b76450005ae27006c077780794c22da328ed7258104] | viable      |
| webhooks-express-container-prisma-redis      | webhook-svix              | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-4e97f0e405f925595fd96f7c2201c78a7014d5ff, artifact-evidence-d5e2cd094b67c01dd3c19b54e89f31d60751abda, ev-40f7f3a9aad23b56dbc916d0dea2a4aa7932c9bb]                                                                                                                                                                                                                                                 | [unk-0e1facb3b0e86d42fae0d27d5e84eec2051011b7, unk-29e401713ae6847d6d0f75e710483325781ca7df, unk-88ed064aeaaa32dffb33cb8f026a5f6889c0d854, assessment-unknown-33c7e1444f2675684c5e77d3e899b93be2cbf1b742e87]                                                                   | recommended |
| webhooks-express-container-prisma-redis      | webhook-hookdeck          | evidence-needed | fully-verified                   |                      0 | [artifact-evidence-db42c135de5723f37c83fd7be6009c2d56379f24, artifact-evidence-5dbbf5b05e5529276ae2aeb7aee0b8f9051db4e6]                                                                                                                                                                                                                                                                                              | [unk-a56d59397aba80de755ae41b1f8e85e55a8043b3, unk-c8242a59d52d0b1120caf7cc1f9f066c45d58f4d, assessment-unknown-78f192b71161a36d0c1670a75cdfa34528b3e785cd6b8]                                                                                                                 | recommended |
| webhooks-express-container-prisma-redis      | webhook-adnanh            | evidence-needed | partially-verified               |                      1 | [artifact-evidence-9f1184779a8966ef4f99d85ccd16cf71cdc4ec13, artifact-evidence-204191e0bf025ba7210d1d52af8d63b1bd4c2217, artifact-evidence-c7ac0cbedef93bf65380934970e847f41718353e]                                                                                                                                                                                                                                  | [unk-5537a25a75980ae8b6cf91744c32b1e6fd3807b0, unk-9bab042fcdc928b2ed1f19129bf6c355d6693c62, assessment-unknown-4f2f3a3ed83fc5c4c37f65765feb47ee20b8ccbbccad3]                                                                                                                 | recommended |
| webhooks-next-selfhosted-drizzle             | webhook-standard-webhooks | evidence-needed | unverified-prohibited-constraint |                      2 | [artifact-evidence-b4696e47dcc0d5627df6c1762a7699319615a601, artifact-evidence-e37bdb1fdb927a8762567a7d314d7c6181a1fc63, artifact-evidence-1b52cd51778fa33e92a715f9f588b8830fc94031, artifact-evidence-6db70c09a00e8d4ba3811dd408bcca617d2264fa, ev-a6bfff68d12935a8f8f1c5579b638f63b72ac400, artifact-evidence-3dc02ec99ec26d56034d111ef3a1d4d73b1c997c]                                                             | [unk-07fa4f4f9e8ab12c6159a6c80b9714a876caaaa7, unk-6aaec47758d76c5f40c7d135da75c7e56edd72e2, unk-dd1cca9273ad91936c18cfae12256ab96a2ac74e, assessment-unknown-1b4be98bf0f228b77b2b01fc54a8ba0756cd935fc49b4]                                                                   | recommended |
| webhooks-next-selfhosted-drizzle             | webhook-hook0             | evidence-needed | unverified-prohibited-constraint |                      4 | [artifact-evidence-cc910bbd588debeb7f983c1565aa6b5a34505024, artifact-evidence-758c1288eb8b0d32d0bca6d964517e8b65205616, artifact-evidence-becd5a78fa819f44d1480a767bd7c928ab0a57fe, artifact-evidence-2fac69fbcd00e49fb4a3d74208643f23652634f1]                                                                                                                                                                      | [unk-1c953f9001ecbf4636000d1235acc3500fe708f8, unk-2fa56d44b31278452756ac4e1518726edb396c7d, unk-93b9e924bc4ecaee6528ef9183c2c7fd002d4838, assessment-unknown-2c491af780e2a221dba1466d4360c8eadc6ff6b839949]                                                                   | viable      |
| webhooks-next-selfhosted-drizzle             | webhook-adnanh            | evidence-needed | unverified-prohibited-constraint |                      3 | [artifact-evidence-9f1184779a8966ef4f99d85ccd16cf71cdc4ec13, artifact-evidence-204191e0bf025ba7210d1d52af8d63b1bd4c2217]                                                                                                                                                                                                                                                                                              | [unk-5537a25a75980ae8b6cf91744c32b1e6fd3807b0, unk-9bab042fcdc928b2ed1f19129bf6c355d6693c62, assessment-unknown-49b4b793069fcb3484d268f4b7e642472ddb44419caca]                                                                                                                 | viable      |

## Model calls

Total model calls made: 15.

Completed model calls: 15.

Deterministically valid responses: 9.

Median completed-call latency: 15543.3 ms.

Maximum completed-call latency: 28267.7 ms.

Median output tokens: 2670.0.

## Assessment diagnostics

Model responses captured for diagnostics: 15 of 15 fixtures.

Harness canonical validations passed: 9.

Diagnostic capture failures: 0.

Unknown totals include supplied candidate unknowns plus model-declared assessment unknowns; limitation totals are the supplied candidate limitation catalog hydrated by validation.

### Domain issue categories

| Category                  | Calls | Occurrences |
| ------------------------- | ----: | ----------: |
| domain.claim.traceability |     3 |           3 |

### Non-domain validation issue categories

| Category           | Calls | Occurrences |
| ------------------ | ----: | ----------: |
| contract.duplicate |     1 |           1 |
| contract.pattern   |     2 |           2 |

### Disposition totals

| Disposition           | Count |
| --------------------- | ----: |
| recommended           |    11 |
| viable                |    35 |
| rejected              |    11 |
| insufficient-evidence |    18 |

### Hard-resolution state totals

| State      | Count |
| ---------- | ----: |
| satisfied  |    62 |
| conflict   |     7 |
| unresolved |   141 |

### Declared catalog totals

| Catalog     | Count |
| ----------- | ----: |
| inferences  |   210 |
| claims      |   163 |
| unknowns    |   312 |
| limitations |     9 |
| conflicts   |     7 |

Fixtures with any satisfied hard resolution: 13.

Candidates with any satisfied hard resolution: 46.

Fixtures with a rejected disposition on a declared conflict: 2.

Candidates with a rejected disposition on a declared conflict: 3.

### Per-fixture diagnostic totals

| Fixture                                        | Response | Validation | Domain issues | Dispositions                                                 | Resolutions                            | Catalogs                                                          | Any satisfied | Rejected conflict |
| ---------------------------------------------- | -------- | ---------- | ------------: | ------------------------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------- | ------------- | ----------------- |
| authorization-next-vercel-drizzle              | captured | failed     |             0 | recommended=0, viable=4, rejected=0, insufficient-evidence=1 | satisfied=4, conflict=0, unresolved=6  | inferences=15, claims=11, unknowns=17, limitations=3, conflicts=0 | yes           | no                |
| authorization-express-container-prisma-redis   | captured | passed     |             0 | recommended=2, viable=2, rejected=0, insufficient-evidence=1 | satisfied=3, conflict=0, unresolved=2  | inferences=8, claims=5, unknowns=18, limitations=3, conflicts=0   | yes           | no                |
| authorization-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=0, viable=5, rejected=0, insufficient-evidence=0 | satisfied=5, conflict=0, unresolved=15 | inferences=13, claims=8, unknowns=17, limitations=3, conflicts=0  | yes           | no                |
| audit-logging-next-vercel-drizzle              | captured | passed     |             0 | recommended=0, viable=0, rejected=0, insufficient-evidence=5 | satisfied=0, conflict=0, unresolved=15 | inferences=7, claims=7, unknowns=30, limitations=0, conflicts=0   | no            | no                |
| audit-logging-express-container-prisma-redis   | captured | passed     |             0 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=6, conflict=0, unresolved=4  | inferences=18, claims=12, unknowns=20, limitations=0, conflicts=0 | yes           | no                |
| audit-logging-next-selfhosted-drizzle          | captured | passed     |             0 | recommended=1, viable=3, rejected=0, insufficient-evidence=1 | satisfied=0, conflict=0, unresolved=25 | inferences=8, claims=8, unknowns=25, limitations=0, conflicts=0   | no            | no                |
| background-jobs-next-vercel-drizzle            | captured | passed     |             0 | recommended=0, viable=4, rejected=1, insufficient-evidence=0 | satisfied=6, conflict=1, unresolved=8  | inferences=17, claims=15, unknowns=18, limitations=0, conflicts=1 | yes           | no                |
| background-jobs-express-container-prisma-redis | captured | failed     |             0 | recommended=2, viable=1, rejected=2, insufficient-evidence=0 | satisfied=5, conflict=0, unresolved=5  | inferences=17, claims=12, unknowns=21, limitations=0, conflicts=0 | yes           | no                |
| background-jobs-next-selfhosted-drizzle        | captured | failed     |             0 | recommended=0, viable=1, rejected=3, insufficient-evidence=1 | satisfied=4, conflict=4, unresolved=17 | inferences=19, claims=17, unknowns=19, limitations=0, conflicts=4 | yes           | yes               |
| rate-limiting-next-vercel-drizzle              | captured | failed     |             1 | recommended=1, viable=1, rejected=0, insufficient-evidence=3 | satisfied=3, conflict=0, unresolved=2  | inferences=7, claims=6, unknowns=28, limitations=0, conflicts=0   | yes           | no                |
| rate-limiting-express-container-prisma-redis   | captured | failed     |             1 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=2  | inferences=6, claims=6, unknowns=21, limitations=0, conflicts=0   | yes           | no                |
| rate-limiting-next-selfhosted-drizzle          | captured | failed     |             1 | recommended=0, viable=3, rejected=0, insufficient-evidence=2 | satisfied=3, conflict=0, unresolved=12 | inferences=8, claims=11, unknowns=19, limitations=0, conflicts=0  | yes           | no                |
| webhooks-next-vercel-drizzle                   | captured | passed     |             0 | recommended=1, viable=1, rejected=3, insufficient-evidence=0 | satisfied=5, conflict=2, unresolved=8  | inferences=23, claims=16, unknowns=21, limitations=0, conflicts=2 | yes           | yes               |
| webhooks-express-container-prisma-redis        | captured | passed     |             0 | recommended=3, viable=2, rejected=0, insufficient-evidence=0 | satisfied=7, conflict=0, unresolved=3  | inferences=20, claims=13, unknowns=18, limitations=0, conflicts=0 | yes           | no                |
| webhooks-next-selfhosted-drizzle               | captured | passed     |             0 | recommended=1, viable=2, rejected=2, insufficient-evidence=0 | satisfied=8, conflict=0, unresolved=17 | inferences=24, claims=16, unknowns=20, limitations=0, conflicts=0 | yes           | no                |

## Failure categories

| Category                    | Calls | Occurrences |
| --------------------------- | ----: | ----------: |
| invalid-target-fit-response |     6 |           6 |
