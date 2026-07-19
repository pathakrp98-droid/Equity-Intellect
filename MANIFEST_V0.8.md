# AlphaDesk v0.8 Manifest

Cumulative release containing Phases 1–8. Apply this package alone over the repository root.

## Validation summary

- 46 cumulative automated tests passed, including 6 Phase 8 integration/security tests.
- 85 TypeScript/TSX files passed syntax transpilation with zero failures.
- Phase 8 readiness engine passed strict standalone TypeScript checking.
- Installation script passed Bash syntax validation.
- Runtime smoke script passed Node syntax validation.
- Legacy simulated dashboard and market routers are not mounted by the cumulative API router.

## Phase 8 files

- `README_ALPHA_DESK_V0.8.md`
- `apply-v0.8.sh`
- `artifacts/api-server/src/app.ts`
- `artifacts/api-server/src/middlewares/securityHeaders.test.ts`
- `artifacts/api-server/src/middlewares/securityHeaders.ts`
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/routes/integration.ts`
- `artifacts/api-server/src/services/integration/integrationService.ts`
- `artifacts/api-server/src/services/integration/readiness.test.ts`
- `artifacts/api-server/src/services/integration/readiness.ts`
- `artifacts/portfolio-intelligence/src/App.tsx`
- `artifacts/portfolio-intelligence/src/components/layout/Layout.tsx`
- `artifacts/portfolio-intelligence/src/components/layout/Sidebar.tsx`
- `artifacts/portfolio-intelligence/src/components/system/ApplicationErrorBoundary.tsx`
- `artifacts/portfolio-intelligence/src/components/system/AsyncState.tsx`
- `artifacts/portfolio-intelligence/src/features/integration/api.ts`
- `artifacts/portfolio-intelligence/src/pages/Dashboard.tsx`
- `artifacts/portfolio-intelligence/src/pages/SystemHealth.tsx`
- `docs/PHASE8_ACCEPTANCE_TESTS.md`
- `docs/PHASE8_DEPLOYMENT_CHECKLIST.md`
- `docs/PHASE8_IMPLEMENTATION.md`
- `docs/PHASE8_SECURITY_REVIEW.md`
- `scripts/phase8-smoke.mjs`

## Complete file checksums

| Path | Bytes | SHA-256 |
|---|---:|---|
| `README_ALPHA_DESK_V0.8.md` | 516 | `9505717f6b5ed2a022386f6b9435aeabb87b757345c934af8a3a9517365f0925` |
| `apply-v0.8.sh` | 648 | `a4c8af77e50d147115da1c2d964e11e0bc8d07e106387c0dd716d0bde590ab87` |
| `artifacts/api-server/src/app.ts` | 2388 | `140010d47d41993686f4e6953d4164a890540b13bf2ba67f4698f7111c70bbfa` |
| `artifacts/api-server/src/middlewares/securityHeaders.test.ts` | 917 | `4594b3acc73344161fb98cd201801fe5e71ea97d10a9f8917d6ede8017697a38` |
| `artifacts/api-server/src/middlewares/securityHeaders.ts` | 1862 | `8c4a68c778d89fb3db23c24d8cc671d41c05db0a90e91c826d93066bd688f0d3` |
| `artifacts/api-server/src/routes/alerts.ts` | 3884 | `b0bac01e025ea991b3fc7be9d6494aaeabdf1d3f75e1e12e96c9063ac8cc24b1` |
| `artifacts/api-server/src/routes/copilot.ts` | 8007 | `e5b16ab002f61a118be3d1f64a1583ffbd9e946f8815efc608f67ead14954634` |
| `artifacts/api-server/src/routes/guardrails.ts` | 5946 | `37746409a42e6187eb8c98fd011446d3506ad6662f9c4e3e0999cb6112709a40` |
| `artifacts/api-server/src/routes/index.ts` | 1073 | `bad4fec0807c131b6a2c90284580fdd2c51c5d3bd21eff2cf68c7dc6383c5268` |
| `artifacts/api-server/src/routes/integration.ts` | 462 | `17f75cdd8c915f999e54cc1ab6b554e7450637dc9b1de6bef5a40625430f41d4` |
| `artifacts/api-server/src/routes/intelligence.ts` | 4094 | `2a350d6c947fcce634705a1b20c17716c00c5a00d294f50b58800d61abe5c489` |
| `artifacts/api-server/src/routes/journal.ts` | 5743 | `7d6a63974bc68eea9390a26f4548652b5a18b346db162e1d07832054e12c1911` |
| `artifacts/api-server/src/routes/liveData.ts` | 3141 | `99e8b258aa02883bac43481d3f2e4c522563aad59fac7a9571d9a00179435b1f` |
| `artifacts/api-server/src/routes/portfolio.ts` | 17888 | `26528a706e666df63f48fe4f1e6f877601a78513fbd4fcb48647746e41336e42` |
| `artifacts/api-server/src/routes/research.ts` | 16444 | `63cb238a88d61cf28e2e8a599e7bf4e9eca79b82fd613284feef4bec6bcf1051` |
| `artifacts/api-server/src/services/alerts/alertEngine.test.ts` | 2309 | `896248a87fe465ee51fd411a9c51a92f0495ab2050a11240499ff4017ee600fd` |
| `artifacts/api-server/src/services/alerts/alertEngine.ts` | 9999 | `a0b901d60587c331c3f69cf971023dd1afa046fee4bc849b7aeb59a4779bd195` |
| `artifacts/api-server/src/services/alerts/alertService.ts` | 26482 | `0e8322fb114ff84960193c328e6ead21e7c3fb29820ca61b30aa18ca61cfe452` |
| `artifacts/api-server/src/services/copilot/copilotService.ts` | 21270 | `d5083dbff4e1e866fc299d2faed1392819d43cd1e93ac15c3de93df10bf444f2` |
| `artifacts/api-server/src/services/copilot/grounding.test.ts` | 2957 | `b0508713a84ac1053a9c2ae1586342c0f0722229c0f6b6d774b02fbff4cf5d68` |
| `artifacts/api-server/src/services/copilot/grounding.ts` | 18094 | `ba960d07dd098f4e756e58c6ff6795a01f4b71668e9a2708f173cc11906ea206` |
| `artifacts/api-server/src/services/copilot/openaiProvider.test.ts` | 2608 | `83fdcb2d6bc97083ce4102068a5f25e01e1371e1d36cb534a6c5c7fa39a7159d` |
| `artifacts/api-server/src/services/copilot/openaiProvider.ts` | 8531 | `d9297554d38ab39bc2bcd4c2adbb16580399fda7008c7cdfe737ff6d20085105` |
| `artifacts/api-server/src/services/guardian/guardianEngine.test.ts` | 6489 | `6e103703f7ff81357e69b661fe3307d1858590abaa301a43fcffc19ab2352d71` |
| `artifacts/api-server/src/services/guardian/guardianEngine.ts` | 32363 | `697e95797275e4455e802d08a1a0d6a21465c56a002b70b697c3008bb1ccb6af` |
| `artifacts/api-server/src/services/guardian/guardianService.ts` | 20929 | `6798d0eece0a282128eb369deac40f0aeda3e912d97b2e9d0db525c75eeb2133` |
| `artifacts/api-server/src/services/integration/integrationService.ts` | 10088 | `a2552e8d97880b2827a22063a413682f43a9e39d5d35ab565291b130116e6eb2` |
| `artifacts/api-server/src/services/integration/readiness.test.ts` | 2795 | `153bc750d18221b5370d2eb93b0321461047592cceba96b942e12e6a7c87788e` |
| `artifacts/api-server/src/services/integration/readiness.ts` | 13314 | `a229221498d47089532d273247e072a575295310da093c24da71d2af2d26d788` |
| `artifacts/api-server/src/services/intelligence/briefEngine.test.ts` | 4765 | `485fd680924cd4485218682ce74fdca963f8cb9fd4ea4eadea700df8e7b111dc` |
| `artifacts/api-server/src/services/intelligence/briefEngine.ts` | 17864 | `d404c03182a0432fe1950e6b5f02a1b049e1f5982e36f7eb068d6d59e7b9e70f` |
| `artifacts/api-server/src/services/intelligence/httpProvider.ts` | 2133 | `7b0bee96136b25b0a6bcbd682da7f22c22965b4fe84a9edd343036713e4faeca` |
| `artifacts/api-server/src/services/intelligence/marketIntelligenceService.ts` | 18134 | `979efaf9e4f1e393b70de9dbad48ecf0a51f44b344d46b0e6c8845db2be3ced5` |
| `artifacts/api-server/src/services/intelligence/normalization.test.ts` | 3337 | `c334bcd1e03b7c3df2ded296b2dca1ef0d8af13cd7d8c34af1e388fe50efae79` |
| `artifacts/api-server/src/services/intelligence/normalization.ts` | 9178 | `d7004e4d9e5b77902b58a8512f6f7814c2af80f7f91f82d558bc9ad480a4759c` |
| `artifacts/api-server/src/services/intelligence/types.ts` | 4732 | `16995f20db1f30d1bf717c60612511107212603dfe9533d5da8efa59aa681cf0` |
| `artifacts/api-server/src/services/journal/journalService.ts` | 33463 | `83fab910fca6aa7fc95a2be515606fb2d7e51ad04c670a86066cd3b9670a3d0a` |
| `artifacts/api-server/src/services/journal/quality.test.ts` | 2524 | `fe6cf9e4b5543223859006c7673df6043e52b27aa25172c7706f330c7b6593d8` |
| `artifacts/api-server/src/services/journal/quality.ts` | 8196 | `6e1dcaec0d4d02c38a158d0236599e9b4bf02028566a9ad3e13b31b060b51e83` |
| `artifacts/api-server/src/services/liveData/alphaVantageProvider.test.ts` | 1452 | `dc401aa8bde1e959254f8d3b3becd621786308f09ef7024d4c54963abc05e878` |
| `artifacts/api-server/src/services/liveData/alphaVantageProvider.ts` | 11663 | `8c515aef2310bb943b6c721a3ec7aa8bf6c94505847042ec837535acd668b876` |
| `artifacts/api-server/src/services/liveData/cachePolicy.test.ts` | 1050 | `b3d88386a0ffcce49c011529fd576050660ca4bc539e16f9127e0f8981fa40cc` |
| `artifacts/api-server/src/services/liveData/cachePolicy.ts` | 1346 | `93a9d3b02ab911d0adf7736b7d1739a3c48d6989a5a86bd3a72a7cff3007d0f5` |
| `artifacts/api-server/src/services/liveData/liveDataService.ts` | 23050 | `274817e8c5aa65ac26f27e4cb518a7de1879786f15adaf2c7f91e1be6460a931` |
| `artifacts/api-server/src/services/liveData/providerRegistry.ts` | 1396 | `d68100644af182a8167eb9619adfbe4a05697882c80c67831481c44daf9a6ca2` |
| `artifacts/api-server/src/services/liveData/types.ts` | 1306 | `bf16abe8cd5674c5ff0ce9eea431c8149bf164908dde246c3ad96a911ffba4f5` |
| `artifacts/api-server/src/services/portfolio/csv.test.ts` | 1447 | `28a383efcbecc3bb1776eba72e6b5f871fe05577b892bcd615e5eb672fbd2143` |
| `artifacts/api-server/src/services/portfolio/csv.ts` | 12290 | `7f9bf89737e64483f33d675c2d4f238052906f2aee521cc7439ac21a6d891d86` |
| `artifacts/api-server/src/services/portfolio/engine.test.ts` | 3084 | `8e473c0df22e55d2b278d5bece98618932c5ade155f6e4a986d198276c8121e4` |
| `artifacts/api-server/src/services/portfolio/engine.ts` | 18360 | `d815c573b05171792dd91587c52fa1934d597a8cf4560b196ce637cc33fe0c21` |
| `artifacts/api-server/src/services/portfolio/portfolioService.ts` | 23547 | `5db391cbee13a22949fc4cd94831f28baa232b1cacc13701254a2b93f4132552` |
| `artifacts/api-server/src/services/research/completeness.test.ts` | 2172 | `c1bae54d207f845948f2d2334caf1e8f6b7de2118bd9b60b88ef2bac0d6a590e` |
| `artifacts/api-server/src/services/research/completeness.ts` | 4797 | `f7614747c2b37e8016482571cde11abb6954e7a8de5fcc818b680aa649c718e1` |
| `artifacts/api-server/src/services/research/researchService.ts` | 34508 | `90e254c11c48a6aac0fda8bc6824040ac977ae9a1e91d11571b2b309289f7ca4` |
| `artifacts/portfolio-intelligence/src/App.tsx` | 3968 | `7f960460a2680b6cddfc489ddf8b7204ace368a9bb9a686914daa97dbc595fc7` |
| `artifacts/portfolio-intelligence/src/components/layout/Layout.tsx` | 3493 | `702a170eac55d5ba4a35704c76bb9ccc15d3947b5603244a64d78232986ee993` |
| `artifacts/portfolio-intelligence/src/components/layout/Sidebar.tsx` | 5408 | `c9df759259932c700b5c5df125ae4f4e62d16a7f6a57f06620ed5a6af74fc188` |
| `artifacts/portfolio-intelligence/src/components/system/ApplicationErrorBoundary.tsx` | 2184 | `e089baaed9a8444d90d0d294d22d548a6d352622eb721c01bda6e7cbb3e82613` |
| `artifacts/portfolio-intelligence/src/components/system/AsyncState.tsx` | 2145 | `e325bdce6f2d90a64e1675a9fd50de6bba4ff97df94b7e1aa6d1077cb601676f` |
| `artifacts/portfolio-intelligence/src/features/alerts/api.ts` | 5962 | `651966e2a25790df79fce08c3f7c7795059976c3e1958a33a5bc56bc836baac7` |
| `artifacts/portfolio-intelligence/src/features/copilot/api.ts` | 7112 | `754627dba274621b81649fa3f489073d807c6bb9ff7ebd574b9491d6605f4af9` |
| `artifacts/portfolio-intelligence/src/features/guardian/api.ts` | 9477 | `1da26fc054fecc670666c7359016d0dccbe2b71fe05a606d344266cb57f8c0c1` |
| `artifacts/portfolio-intelligence/src/features/integration/api.ts` | 1893 | `a0953318194d9ba78fed5e8757551a997d413bbdd4a5453f05f0e4764fe624ba` |
| `artifacts/portfolio-intelligence/src/features/intelligence/api.ts` | 8448 | `909cfa5391450510161ff6dc3e7bfebf96252f9350f651af2e5e72288d3324a9` |
| `artifacts/portfolio-intelligence/src/features/journal/api.ts` | 10301 | `74352cf22e4f7343c4674bf2ffab439c630084f3ca8f319b47f01eeef99fb7bc` |
| `artifacts/portfolio-intelligence/src/features/liveData/api.ts` | 5442 | `2f78853d4205da52a8d2204da681f3bf4b1a5e5a2151c22296b64475b433f0fc` |
| `artifacts/portfolio-intelligence/src/features/portfolio/api.ts` | 6926 | `fd17fe446043e0c5c7139f2f5bc6a2a5ab0b4e8e67cbf3ecd04de922152251d3` |
| `artifacts/portfolio-intelligence/src/features/research/api.ts` | 13520 | `e060a6ce60d6268570bdfd7e06381ba359aedaf2cd3ed6ac4bfb47881304043f` |
| `artifacts/portfolio-intelligence/src/pages/Alerts.tsx` | 20378 | `cf1941337892f4776d15d2a28e3a86fab2051221a9490c746f8db787ae2e86bc` |
| `artifacts/portfolio-intelligence/src/pages/Copilot.tsx` | 34374 | `7233cfd1c0501b7265424b9c88ad4969769d09227064bf3daf481a75836143a6` |
| `artifacts/portfolio-intelligence/src/pages/Dashboard.tsx` | 20510 | `780830c4ef23dd5243c385510f2d79cd05b32cb7fb014e1d8320f218bc6110e0` |
| `artifacts/portfolio-intelligence/src/pages/Guardrails.tsx` | 32168 | `f88cbed4c0776ed3aee0b630f725aa31cb0595b711345a722474329f5d737238` |
| `artifacts/portfolio-intelligence/src/pages/Journal.tsx` | 56092 | `55067a1444def498e267fc782950328b5ad721031931ed5c4b2a108fe16033b4` |
| `artifacts/portfolio-intelligence/src/pages/LiveData.tsx` | 16509 | `44725031a7b19012e81d39fb5a943dd77f5a2ea42eda12e3a75f214d2c1e2eba` |
| `artifacts/portfolio-intelligence/src/pages/MarketIntelligence.tsx` | 26140 | `3e171f68d56472409064a3131c1029f0bd7231b9612d3a874c289acfb71a170d` |
| `artifacts/portfolio-intelligence/src/pages/PortfolioEngine.tsx` | 37652 | `712bbf2adf2b1f70c25e311cf0fb44849230d9fe83e68ed8aec2d27549bc2081` |
| `artifacts/portfolio-intelligence/src/pages/Research.tsx` | 72245 | `f30fee9f64e44cc826c110091f6c99900c9f949dcefac6a85f68e12bf6da15b0` |
| `artifacts/portfolio-intelligence/src/pages/SystemHealth.tsx` | 13260 | `29d4d1970cbadd62e16a635c99f6eec231ae37aecef9a2641cc55ce18caa911e` |
| `docs/ALERT_RULE_EXAMPLE.json` | 200 | `e13d5389d11651eeac8ce09451166e6ad68c46be04e1398dad4bc0257e276232` |
| `docs/GUARDIAN_CHECK_EXAMPLE.json` | 710 | `b2039eb3a54872577ed3fb9b816abb0b50516a2a3cf2b7a14b58d2cdb1358693` |
| `docs/JOURNAL_ENTRY_EXAMPLE.json` | 1329 | `a6e8ff360a746cdf09deb040275276e02aeec51c0ae5f4e3f2eeacf26ac1cadc` |
| `docs/LIVE_DATA_ENVIRONMENT_EXAMPLE.md` | 869 | `bc3b07001c17be8536bb0ccdd7a91d5bfb13c1f62e53b06f1afaebbee2d1c5b4` |
| `docs/MARKET_INTELLIGENCE_IMPORT_EXAMPLE.json` | 1710 | `716183d085fa33991f1871e44eefff49d2f587dfcdbc978f7d0ea7e4161e5af7` |
| `docs/PHASE1_IMPLEMENTATION.md` | 4897 | `82e311c095255e721e4d031edd32335172f149a249182699176f10003a696a3f` |
| `docs/PHASE1_MANIFEST.md` | 1180 | `5dda9ae34833cdb9627514a920d684c7f9e94273abeff9669606ddb5d8cf109d` |
| `docs/PHASE2_IMPLEMENTATION.md` | 3609 | `1cae77659d41aee50b4b147d031e927bc433fcaa1783d481935c8f0920beb3a0` |
| `docs/PHASE3_IMPLEMENTATION.md` | 5875 | `098af4a78305ef328033656573fac0169eab38d84b9b3fe93be8effe13e815a3` |
| `docs/PHASE4_IMPLEMENTATION.md` | 8254 | `bcfefb752890f58e5046bca6418df90428014e07243a6a7e5698fb94fa7d08a8` |
| `docs/PHASE5_IMPLEMENTATION.md` | 5229 | `d3927ff82d0bc5f68a8639a3d60849b90562430d7cd6c76d0ddce7d866658e3d` |
| `docs/PHASE6_IMPLEMENTATION.md` | 5099 | `1a890289621147965538f1940f351fbea65096144503325fea8901e5d788d0b9` |
| `docs/PHASE7_IMPLEMENTATION.md` | 6502 | `66fa60c1884ad8d89e591fdcba8d7aca8451f5642755cce58f5b3d4d1931ba03` |
| `docs/PHASE8_ACCEPTANCE_TESTS.md` | 1662 | `a00af5d11a73c740524ffaedef4a9971087a4533edb181ed8c14e10b9fdcaf09` |
| `docs/PHASE8_DEPLOYMENT_CHECKLIST.md` | 2055 | `e8690fb09e27d39bbf1bb46df1ded9c2d257e170eab70596f9d6516edae8cc5e` |
| `docs/PHASE8_IMPLEMENTATION.md` | 4735 | `75f93517e55556ec8ef8f7bdaf3448031cb13ca09a98a6ae1e16928a52d699cb` |
| `docs/PHASE8_SECURITY_REVIEW.md` | 2386 | `2e7a1ac51990f7b3d3760847af99fcb2a455599f3ed72b9aa1a93766d805ab89` |
| `lib/db/src/schema/alerts.ts` | 5566 | `7f133c503346439d0adac5e87f92ad464d65a9fde624a1a67c7f41241da9c533` |
| `lib/db/src/schema/copilot.ts` | 5228 | `3e124fbea4731c30c43fda6ccb5599881a1db4e0a91c23b998c2426cee9bc62d` |
| `lib/db/src/schema/guardian.ts` | 4213 | `0de09fe67ddf5192b03c83c2f96d6370fcfdfdb22403eab4ab84063f97cba0d8` |
| `lib/db/src/schema/index.ts` | 282 | `9af036893b828959b860c9c06057f08d71906acc409aacc5eb02ae7b45452d11` |
| `lib/db/src/schema/journal.ts` | 7764 | `70dcfeb2511211cff18198b058af4ac5c83b8a62cdc2aa1c7265fff44319512c` |
| `lib/db/src/schema/liveData.ts` | 3996 | `4ba194bd1146ed4467a8f8c713805ad166074f95f64900bd89c288534b8700ee` |
| `lib/db/src/schema/marketIntelligence.ts` | 11063 | `950b993e26cefd1096fd3ccb593b6f48ddb38fe722d728315ed097c9a739d072` |
| `lib/db/src/schema/portfolio.ts` | 9793 | `52958ea29cf977ffdd336b5d88adbfa397bd8d071d312533f5ba8b017635fd1e` |
| `lib/db/src/schema/research.ts` | 10320 | `b9f090fead89ef4a4a2c963d1d04889798de75311cbdc1854dceb1972b3796ce` |
| `scripts/phase8-smoke.mjs` | 1348 | `a70e8fe0cc3f363eefafdf332021a3b5399b66aacd31b300738424d98882df21` |
