import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { initialState, advance } from './workflow.mjs';

const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
function inside(root, path) {
  const location = realpathSync(resolve(root, path));
  const rel = relative(realpathSync(root), location);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Path escapes repository: ${path}`);
  return location;
}
function save(path, state) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n', { flag: 'wx' });
  renameSync(temporary, path);
}
function snapshot(root, path) {
  const location = inside(root, path);
  return { contentHash: hash(location), target: relative(root, location) };
}

try {
  const [action, ...args] = process.argv.slice(2);
  const options = {};
  const flags = new Set(['allow-dirty', 'hard-to-reverse']);
  const allowed = new Set(['cwd', 'size', 'plan-audit', 'run', 'stage', 'outcome', 'report', 'tests', 'allow-dirty', 'hard-to-reverse', 'reason']);
  for (let index = 0; index < args.length; index++) {
    const key = args[index].replace(/^--/, '');
    if (!args[index].startsWith('--') || !allowed.has(key) || Object.hasOwn(options, key)) throw new Error(`Invalid option: ${args[index]}`);
    options[key] = flags.has(key) ? true : args[++index];
    if (!options[key] || (typeof options[key] === 'string' && options[key].startsWith('--'))) throw new Error(`Missing --${key} value`);
  }
  if (!options.cwd) throw new Error('--cwd is required');
  const requestedRoot = realpathSync(resolve(options.cwd));
  const topLevel = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: requestedRoot, encoding: 'utf8' });
  if (topLevel.status !== 0) throw new Error('A Git working tree is required');
  const root = realpathSync(topLevel.stdout.trim());
  const git = (...parameters) => spawnSync('git', parameters, { cwd: root, encoding: 'utf8' });
  const head = git('rev-parse', 'HEAD');
  if (head.status !== 0) throw new Error('A Git repository with a base commit is required');
  const home = join(root, '.dev-team');
  mkdirSync(home, { recursive: true });
  inside(root, home);
  const lock = join(home, 'active.json');
  if (action === 'start') {
    const dirty = git('status', '--porcelain');
    if (dirty.status !== 0) throw new Error('git status failed');
    if (dirty.stdout.trim() && !options['allow-dirty']) throw new Error('Dirty working tree; obtain user consent before --allow-dirty');
    const state = initialState(options.size ?? 'standard', options['plan-audit'] ?? 'auto');
    Object.assign(state, { id: `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`, base: head.stdout.trim(), root, initialDirty: dirty.stdout, tests: {}, createdAt: new Date().toISOString() });
    writeFileSync(lock, JSON.stringify({ id: state.id }) + '\n', { flag: 'wx' });
    try {
      const directory = join(home, state.id);
      mkdirSync(directory);
      if (!existsSync(join(home, '.gitignore'))) writeFileSync(join(home, '.gitignore'), '*\n', { flag: 'wx' });
      save(join(directory, 'run.json'), state);
      process.stdout.write(JSON.stringify({ run: directory, ...state }, null, 2) + '\n');
    } catch (error) {
      unlinkSync(lock);
      throw error;
    }
  } else {
    if (!options.run) throw new Error('--run is required');
    const directory = inside(home, options.run);
    const file = inside(directory, 'run.json');
    let state = JSON.parse(readFileSync(file, 'utf8'));
    if (state.root !== root || state.schema !== 1) throw new Error('Run does not belong to this repository');
    if (action === 'status') process.stdout.write(JSON.stringify(state, null, 2) + '\n');
    else {
      if (!existsSync(lock) || JSON.parse(readFileSync(lock, 'utf8')).id !== state.id) throw new Error('Run does not own the active lock');
      if (action === 'abort') {
        if (!options.reason) throw new Error('--reason is required; stop active agents before aborting');
        state.status = 'blocked';
        state.next = null;
        state.reason = options.reason;
      } else if (action === 'record') {
        if (head.stdout.trim() !== state.base) throw new Error('Base commit changed during run');
        if (!options.report) throw new Error('--report is required');
        const report = inside(directory, options.report);
        if (!readFileSync(report, 'utf8').trim()) throw new Error('Empty role report');
        if (options.stage === 'tester' && options.outcome === 'pass') {
          if (!options.tests) throw new Error('--tests must name a JSON array of tester-owned paths (or [] for manual-only criteria)');
          const paths = JSON.parse(readFileSync(inside(directory, options.tests), 'utf8'));
          if (!Array.isArray(paths) || paths.some(path => typeof path !== 'string')) throw new Error('Invalid test path list');
          state.tests = Object.fromEntries(paths.map(path => [relative(root, resolve(root, path)), snapshot(root, path)]));
        }
        if (options.stage === 'coder') {
          const changed = Object.entries(state.tests).filter(([path, expected]) => {
            try {
              const current = snapshot(root, path);
              return current.contentHash !== expected.contentHash || current.target !== expected.target;
            } catch {
              return true;
            }
          }).map(([path]) => path);
          if (changed.length) {
            options.outcome = 'error';
            state.reason = `Tester-owned tests changed: ${changed.join(', ')}`;
          }
        }
        state = advance(state, { stage: options.stage, outcome: options.outcome, report: relative(directory, report), reportHash: hash(report), hardToReverse: Boolean(options['hard-to-reverse']) });
      } else throw new Error('Use start, status, record, or abort');
      save(file, state);
      if (state.status !== 'running') unlinkSync(lock);
      process.stdout.write(JSON.stringify(state, null, 2) + '\n');
    }
  }
} catch (error) {
  process.stderr.write(`dev-team state: ${error.code === 'EEXIST' ? 'Another run owns the worktree lock; inspect it before proceeding' : error.message}\n`);
  process.exitCode = 2;
}
