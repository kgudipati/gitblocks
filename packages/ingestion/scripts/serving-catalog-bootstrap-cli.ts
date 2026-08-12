import { runServingCatalogBootstrapCliV1 } from './serving-catalog-bootstrap-command.ts';

process.exitCode = await runServingCatalogBootstrapCliV1(process.argv.slice(2));
