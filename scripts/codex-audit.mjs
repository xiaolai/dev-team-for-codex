import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { codexAuditPrompt, parseAuditArgs } from './lib.mjs';
import { readRoleSettings, validateCatalog } from './project.mjs';

function fail(code, message) {
  process.stderr.write(`Audit failed: ${message}\n`);
  process.exit(code);
}

let args;
let overrides = {};
try {
  const argv = process.argv.slice(2);
  const remaining = [];
  for (let index = 0; index < argv.length; index++) {
    if (['--model', '--effort'].includes(argv[index])) {
      const key = argv[index].slice(2);
      const value = argv[++index];
      if (!value || value.startsWith('--') || overrides[key]) throw new Error(`Invalid --${key}`);
      overrides[key] = value;
    } else remaining.push(argv[index]);
  }
  args = parseAuditArgs(remaining);
} catch (error) {
  fail(2, error.message);
}
const cwd = resolve(args.cwd ?? process.cwd());
const git = (...parameters) => spawnSync('git', parameters, { cwd, encoding: 'utf8' });
if (git('rev-parse', '--is-inside-work-tree').stdout?.trim() !== 'true') fail(2, 'Not a Git working tree');
if (args.target === 'diff' && git('rev-parse', '--verify', '--quiet', '--end-of-options', `${args.base}^{commit}`).status !== 0) fail(2, 'Invalid base commit');
if (args.target === 'diff') args.base = git('rev-parse', '--verify', '--end-of-options', `${args.base}^{commit}`).stdout.trim();
if (args.plan && !existsSync(resolve(cwd, args.plan))) fail(2, 'Plan file not found');
const version = spawnSync('codex', ['--version'], { encoding: 'utf8' });
if (version.error?.code === 'ENOENT') fail(3, 'Codex CLI not found on PATH');
if (version.status !== 0) fail(4, 'codex --version failed');
let settings;
try {
  const defaults = !existsSync(join(cwd, '.codex/agents/dev_team_auditor.toml'));
  settings = { ...readRoleSettings(cwd, 'auditor', { defaults }), ...overrides };
  const catalog = spawnSync('codex', ['debug', 'models'], { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
  if (catalog.status !== 0) throw new Error('Model discovery failed');
  const parsed = JSON.parse(catalog.stdout);
  validateCatalog(settings, Array.isArray(parsed) ? parsed : parsed.models);
} catch (error) {
  fail(2, error.message);
}
const directory = mkdtempSync(join(tmpdir(), 'dev-team-audit-'));
let error;
let message;
try {
  const output = join(directory, 'last-message.md');
  const result = spawnSync('codex', ['exec', '--ignore-user-config', '-s', 'read-only', '-C', cwd, '--ephemeral', '-m', settings.model, '-c', `model_reasoning_effort=${JSON.stringify(settings.effort)}`, '-c', 'agents.enabled=false', '-c', 'features.apps=false', '-o', output, '-'], { input: codexAuditPrompt(args), encoding: 'utf8', timeout: args.timeoutSec * 1000, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) error = result.error.code === 'ETIMEDOUT' ? `Timeout after ${args.timeoutSec}s` : result.error.message;
  else if (result.status !== 0) error = `Codex exited ${result.status}: ${(result.stderr ?? '').slice(-1000)}`;
  else {
    message = existsSync(output) ? readFileSync(output, 'utf8').trim() : '';
    if (!/^VERDICT: (pass|fail)$/.test(message.split('\n').at(-1) ?? '')) error = 'Missing closing VERDICT line; no completed audit';
    else if (message.split('\n').slice(0, -1).join('\n').trim() === '') error = 'Missing audit findings body';
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
if (error) fail(4, error);
const lines = message.split('\n');
const verdict = lines.pop().slice('VERDICT: '.length);
process.stdout.write(`## Engine\ncodex (${version.stdout.trim()}), process, ${settings.model}, ${settings.effort}, target: ${args.target}, profile: ${existsSync(join(cwd, '.codex/dev-team.md')) ? 'found' : 'missing'}\n\n## Findings\n${lines.join('\n').trim()}\n\n## Verdict\n${verdict}\n`);
