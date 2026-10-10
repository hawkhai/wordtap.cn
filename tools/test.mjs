import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const tests = readdirSync('tools').filter(file => file.endsWith('.test.mjs')).sort();
if (!tests.length) throw new Error('No business tests found');
const result = spawnSync(process.execPath, ['--test', ...tests.map(file => `tools/${file}`)], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
