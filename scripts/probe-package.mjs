import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { packageRoot } from './project.mjs';

const directory = mkdtempSync(join(tmpdir(), 'dev-team-package-probe-'));
const client = process.env.DEV_TEAM_PROBE_CODEX ?? 'codex';
const env = { ...process.env, CODEX_HOME: directory };
const results = [];
for (const args of [['plugin', 'marketplace', 'add', packageRoot], ['plugin', 'add', 'dev-team@xiaolai-dev-team', '--json']]) {
  const result = spawnSync(client, args, { cwd: directory, env, encoding: 'utf8', timeout: 60000 });
  results.push({ args, status: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message });
  if (result.status !== 0) break;
}
function manifests(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? manifests(path) : entry.name === 'plugin.json' ? [{ path, name: JSON.parse(readFileSync(path, 'utf8')).name }] : [];
  });
}
const installed = manifests(directory);
process.stdout.write(JSON.stringify({ directory, results, installed }, null, 2) + '\n');
process.exitCode = results.length === 2 && results.every(result => result.status === 0) && installed.some(entry => entry.name === 'dev-team') ? 0 : 1;
