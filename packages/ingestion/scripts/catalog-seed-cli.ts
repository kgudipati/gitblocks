import { runCatalogSeedCliV1 } from './catalog-seed-command.ts';

process.exitCode = await runCatalogSeedCliV1(process.argv.slice(2));
