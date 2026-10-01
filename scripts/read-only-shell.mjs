import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { join } from 'node:path';
import { readOnlyCommand } from './read-only-command.mjs';

const encoded = process.argv[2];
if (process.argv.length !== 3 || !encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
  process.stderr.write('dev-team: invalid read-only command payload\n');
  process.exit(2);
}
const command = Buffer.from(encoded, 'base64').toString('utf8');
try {
  const { systemProgram, args } = readOnlyCommand(command);
  const directories = systemProgram === 'rg' ? ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'] : ['/usr/bin', '/bin'];
  const executable = directories.map(directory => join(directory, systemProgram)).find(path => {
    try { accessSync(path, constants.X_OK); return true; } catch { return false; }
  });
  if (!executable) throw new Error(`Read tool not found: ${systemProgram}`);
  const env = { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin', GIT_PAGER: 'cat', GIT_EXTERNAL_DIFF: '', GIT_OPTIONAL_LOCKS: '0' };
  const filterOverrides = [];
  if (systemProgram === 'git') {
    const filters = spawnSync(executable, ['config', '--null', '--name-only', '--get-regexp', '^filter\\..*\\.(clean|smudge|process|required)$'], { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024, env });
    if (filters.error || ![0, 1].includes(filters.status)) throw new Error('Could not inspect Git filter configuration');
    const names = new Set(filters.stdout.split('\0').filter(Boolean).map(key => key.replace(/\.(clean|smudge|process|required)$/, '')));
    for (const name of names) {
      if (!/^filter\..+$/.test(name) || /[\r\n\0]/.test(name)) throw new Error('Invalid Git filter name');
      for (const property of ['clean', 'smudge', 'process']) filterOverrides.push('-c', `${name}.${property}=`);
      filterOverrides.push('-c', `${name}.required=false`);
    }
  }
  const result = spawnSync(executable, [...filterOverrides, ...args], { stdio: ['ignore', 'inherit', 'inherit'], timeout: 30000, env });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 2;
} catch (error) {
  process.stderr.write(`dev-team: read-only command blocked or failed: ${error.message}\n`);
  process.exitCode = 2;
}
