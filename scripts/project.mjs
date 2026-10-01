import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

export const packageRoot = resolve(import.meta.dirname, '..');
const packageVersion = JSON.parse(readFileSync(join(packageRoot, '.codex-plugin/plugin.json'), 'utf8')).version;
export const roles = ['scout', 'planner', 'tester', 'coder', 'auditor', 'releaser', 'consultant'];
const manifestName = '.codex/dev-team-install.json';
const agentPath = role => `.codex/agents/dev_team_${role}.toml`;
const digest = value => createHash('sha256').update(value).digest('hex');

function assertPaths(root) {
  for (const path of ['.codex', '.codex/agents', manifestName, ...roles.map(agentPath)]) {
    const absolute = join(root, path);
    if (existsSync(absolute) && lstatSync(absolute).isSymbolicLink()) throw new Error(`Refusing symlink: ${path}`);
    try {
      if (lstatSync(absolute).isSymbolicLink()) throw new Error(`Refusing symlink: ${path}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

function atomicWrite(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, content, { flag: 'wx', mode: 0o600 });
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export function installProject(directory, { check = false, uninstall = false } = {}) {
  const root = resolve(directory);
  assertPaths(root);
  const manifestPath = join(root, manifestName);
  const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { schema: 1, files: {} };
  if (previous.schema !== 1 || !previous.files || Object.keys(previous.files).some(path => !roles.map(agentPath).includes(path))) throw new Error('Invalid ownership manifest');
  const pending = [];
  const preserved = [];
  const desired = {};
  const backups = new Map();
  for (const role of roles) {
    const relative = agentPath(role);
    const destination = join(root, relative);
    const current = existsSync(destination) ? readFileSync(destination, 'utf8') : null;
    const content = readFileSync(join(packageRoot, 'templates/agents', `dev_team_${role}.toml`), 'utf8');
    if (uninstall) {
      if (current !== null && previous.files[relative] === digest(current)) pending.push(relative);
      else if (current !== null && previous.files[relative]) preserved.push(relative);
    } else {
      if (current === content && !Object.hasOwn(previous.files, relative)) {
        preserved.push(relative);
        continue;
      }
      desired[relative] = digest(content);
      if (current !== content && current !== null && previous.files[relative] !== digest(current)) throw new Error(`Agent conflict: customized or unowned ${relative}; review before replacing it`);
      if (current !== content) pending.push(relative);
    }
    backups.set(relative, current);
  }
  if (check) return { pending, preserved, written: [], removed: [] };
  const oldManifest = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : null;
  try {
    for (const relative of pending) {
      if (uninstall) unlinkSync(join(root, relative));
      else atomicWrite(join(root, relative), readFileSync(join(packageRoot, 'templates/agents', relative.split('/').at(-1)), 'utf8'));
    }
    const files = uninstall ? Object.fromEntries(preserved.map(path => [path, previous.files[path]])) : desired;
    const manifest = JSON.stringify({ schema: 1, version: packageVersion, files }, null, 2) + '\n';
    if (uninstall && preserved.length === 0) {
      if (existsSync(manifestPath)) unlinkSync(manifestPath);
    } else if (manifest !== oldManifest) atomicWrite(manifestPath, manifest);
  } catch (error) {
    for (const relative of pending) {
      const old = backups.get(relative);
      if (old === null) {
        if (existsSync(join(root, relative))) unlinkSync(join(root, relative));
      } else atomicWrite(join(root, relative), old);
    }
    if (oldManifest !== null) atomicWrite(manifestPath, oldManifest);
    throw error;
  }
  return { pending, preserved, written: uninstall ? [] : pending, removed: uninstall ? pending : [] };
}

export function readRoleSettings(directory, role, { defaults = false } = {}) {
  if (!roles.includes(role)) throw new Error(`Unknown role: ${role}`);
  const path = defaults ? join(packageRoot, 'templates/agents', `dev_team_${role}.toml`) : join(resolve(directory), agentPath(role));
  const header = readFileSync(path, 'utf8').split(/^developer_instructions\s*=/m)[0];
  function readString(key) {
    const matches = [...header.matchAll(new RegExp(`^${key}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*"|'[^']*')\\s*(?:#.*)?$`, 'gm'))];
    if (matches.length !== 1) throw new Error(`Expected one quoted ${key} before developer_instructions in ${agentPath(role)}`);
    const value = matches[0][1];
    return value.startsWith('"') ? JSON.parse(value) : value.slice(1, -1);
  }
  const model = readString('model');
  const effort = readString('model_reasoning_effort');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(model)) throw new Error('Invalid model');
  if (!['low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(effort)) throw new Error(`Invalid reasoning effort: ${effort}`);
  return { model, effort };
}

export function validateCatalog(settings, models) {
  const model = models.find(entry => entry.slug === settings.model && entry.visibility !== 'hide');
  if (!model) throw new Error(`Model unavailable: ${settings.model}`);
  if (!model.supported_reasoning_levels?.some(level => level.effort === settings.effort)) throw new Error(`Unsupported effort ${settings.effort} for ${settings.model}`);
}
