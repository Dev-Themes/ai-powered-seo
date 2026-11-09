import { build } from 'esbuild';
import { mkdir, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const mode = process.argv[2];
await mkdir('.local/tools', { recursive: true });

const inputs =
  mode === 'test'
    ? (await readdir('tests')).filter(f => f.endsWith('.test.ts')).map(f => 'tests/' + f)
    : mode === 'automation' || mode === 'audit'
    ? ['scripts/automation.ts']
    : [];

if (!inputs.length) throw new Error('Unknown tool or no tests found');

const output = [];
for (const file of inputs) {
  const name = file.split('/').at(-1).replace(/\.ts$/, '.mjs');
  const target = '.local/tools/' + name;
  await build({
    entryPoints: [file],
    outfile: target,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    packages: 'external',
    logLevel: 'warning'
  });
  output.push(target);
}

const args = [
  '--conditions=react-server',
  ...(mode === 'test' ? ['--test', ...output] : [output[0], ...process.argv.slice(3)])
];

const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
process.exitCode = result.status ?? 1;
