import process from 'node:process';

const repeatedOutput = 'x'.repeat(4_096);

process.stdout.write(`fixture stdout: ${repeatedOutput}`);
process.stderr.write(`fixture stderr: ${repeatedOutput}`);
process.exitCode = 7;
