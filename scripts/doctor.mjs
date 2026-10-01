import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { roles, readRoleSettings, validateCatalog } from './project.mjs';

try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--cwd') throw new Error('Usage: node scripts/doctor.mjs --cwd <repository>');
  const root = resolve(args[1]);
  const version = spawnSync('codex', ['--version'], { encoding: 'utf8' });
  if (version.error || version.status !== 0) throw new Error('Codex CLI is required on PATH');
  const numbers = version.stdout.match(/(\d+)\.(\d+)\.(\d+)/)?.slice(1).map(Number);
  if (!numbers || (numbers[0] === 0 && (numbers[1] < 159 || (numbers[1] === 159 && numbers[2] < 2)))) throw new Error('Codex CLI 0.159.2 or later is required');
  const catalog = spawnSync('codex', ['debug', 'models'], { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
  if (catalog.error || catalog.status !== 0) throw new Error('Could not obtain Codex model catalog; no model was substituted');
  const parsed = JSON.parse(catalog.stdout);
  const models = Array.isArray(parsed) ? parsed : parsed.models;
  if (!Array.isArray(models)) throw new Error('Invalid model catalog');
  const configured = roles.map(role => {
    const settings = readRoleSettings(root, role);
    validateCatalog(settings, models);
    return { role, ...settings };
  });
  const profile = join(root, '.codex/dev-team.md');
  if (!existsSync(profile)) throw new Error('Profile missing: run dev-team-init');
  const text = readFileSync(profile, 'utf8');
  if (/\{\{[^}]+\}\}/.test(text)) throw new Error('Profile still contains template placeholders');
  for (const section of ['Commands', 'Conventions', 'Protected paths', 'Release', 'Auditor']) {
    if (!text.includes(`## ${section}`)) throw new Error(`Profile is missing ${section}`);
  }
  const engine = text.match(/^Engine:\s*(\S+)\s*$/m)?.[1];
  if (engine !== 'codex') throw new Error(`Unsupported auditor engine: ${engine ?? 'missing'}; this package never substitutes engines`);
  process.stdout.write(JSON.stringify({ cli: version.stdout.trim(), roles: configured, profile: 'found', hookTrust: 'not established by doctor; every dispatched role must pass the live guard probe', inference: 'catalog checked; availability is confirmed only when each role runs' }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`dev-team doctor: ${error.message}\n`);
  process.exitCode = 2;
}
