import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installProject } from './project.mjs';

const script = name => join(import.meta.dirname, name);
function repository() {
  const root = mkdtempSync(join(tmpdir(), 'dev-team-e2e-'));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  git('init', '-q');
  writeFileSync(join(root, 'product.txt'), 'original\n');
  git('add', 'product.txt');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Fixture');
  return root;
}
function state(root, action, args = []) {
  const result = spawnSync(process.execPath, [script('run-state.mjs'), action, '--cwd', root, ...args], { encoding: 'utf8' });
  return { ...result, value: result.status === 0 ? JSON.parse(result.stdout) : null };
}

test('worktree lock prevents overlapping runs and completion releases it', () => {
  const root = repository();
  const started = state(root, 'start', ['--size', 'small']);
  assert.equal(started.status, 0, started.stderr);
  const run = started.value.run;
  assert.equal(state(root, 'start').status, 2);
  writeFileSync(join(run, 'report.md'), 'fixture report');
  writeFileSync(join(run, 'paths.json'), '[]');
  for (const stage of ['planner', 'tester', 'coder', 'audit']) {
    const args = ['--run', run, '--stage', stage, '--outcome', 'pass', '--report', 'report.md'];
    if (stage === 'tester') args.push('--tests', 'paths.json');
    const result = state(root, 'record', args);
    assert.equal(result.status, 0, result.stderr);
  }
  assert.equal(existsSync(join(root, '.dev-team/active.json')), false);
  assert.equal(state(root, 'status', ['--run', run]).value.status, 'complete');
});

test('changed tester files block the coder and preserve the evidence', () => {
  const root = repository();
  const run = state(root, 'start', ['--size', 'small']).value.run;
  writeFileSync(join(run, 'report.md'), 'fixture report');
  const record = (stage, extra = []) => state(root, 'record', ['--run', run, '--stage', stage, '--outcome', 'pass', '--report', 'report.md', ...extra]);
  assert.equal(record('planner').status, 0);
  writeFileSync(join(root, 'test.txt'), 'independent test');
  writeFileSync(join(run, 'paths.json'), '["test.txt"]');
  assert.equal(record('tester', ['--tests', 'paths.json']).status, 0);
  writeFileSync(join(root, 'test.txt'), 'weakened test');
  const result = record('coder');
  assert.equal(result.value.status, 'blocked');
  assert.match(result.value.reason, /Tester-owned tests changed/);
  assert.equal(readFileSync(join(root, 'test.txt'), 'utf8'), 'weakened test');
});

test('dirty tree and out-of-run reports require explicit handling', () => {
  const root = repository();
  writeFileSync(join(root, 'product.txt'), 'user edit');
  assert.equal(state(root, 'start').status, 2);
  const run = state(root, 'start', ['--allow-dirty', '--size', 'small']).value.run;
  assert.equal(state(root, 'record', ['--run', run, '--stage', 'planner', '--outcome', 'pass', '--report', join(root, 'product.txt')]).status, 2);
  assert.equal(state(root, 'abort', ['--run', run, '--reason', 'test finished']).status, 0);
});

test('subdirectory invocation shares the same worktree lock', () => {
  const root = repository();
  mkdirSync(join(root, 'src'));
  const started = state(root, 'start');
  assert.equal(started.status, 0);
  assert.equal(state(join(root, 'src'), 'start').status, 2);
  assert.equal(state(join(root, 'src'), 'abort', ['--run', started.value.run, '--reason', 'test finished']).status, 0);
});

test('retargeting a tester-owned symlink stops the run', () => {
  const root = repository();
  const run = state(root, 'start', ['--size', 'small']).value.run;
  writeFileSync(join(run, 'report.md'), 'fixture report');
  const record = (stage, extra = []) => state(root, 'record', ['--run', run, '--stage', stage, '--outcome', 'pass', '--report', 'report.md', ...extra]);
  assert.equal(record('planner').status, 0);
  writeFileSync(join(root, 'real.txt'), 'test assertions');
  writeFileSync(join(root, 'fake.txt'), 'nothing checked');
  symlinkSync('real.txt', join(root, 'test.txt'));
  writeFileSync(join(run, 'paths.json'), '["test.txt"]');
  assert.equal(record('tester', ['--tests', 'paths.json']).status, 0);
  unlinkSync(join(root, 'test.txt'));
  symlinkSync('fake.txt', join(root, 'test.txt'));
  assert.equal(record('coder').value.status, 'blocked');
});

function auditFixture(mode = 'ok') {
  const root = repository();
  installProject(root);
  const bin = join(root, 'bin');
  mkdirSync(bin);
  const executable = join(bin, 'codex');
  writeFileSync(executable, `#!${process.execPath}
import fs from 'node:fs';
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('codex-cli 0.159.2'); process.exit(0); }
if (args[0] === 'debug') { console.log(JSON.stringify([{slug:'gpt-6.1-sol',visibility:'list',supported_reasoning_levels:[{effort:'xhigh'},{effort:'high'}]}])); process.exit(0); }
fs.writeFileSync(process.env.STUB_LOG, JSON.stringify({args,prompt:fs.readFileSync(0,'utf8')}));
if (process.env.STUB_MODE === 'fail') process.exit(1);
if (process.env.STUB_MODE === 'timeout') await new Promise(resolve => setTimeout(resolve, 2000));
const message = process.env.STUB_MODE === 'bad' ? 'Audit incomplete' : 'none\\nVERDICT: pass';
fs.writeFileSync(args[args.indexOf('-o') + 1], message);
`);
  chmodSync(executable, 0o755);
  const log = join(root, 'args.json');
  const run = extra => spawnSync(process.execPath, [script('codex-audit.mjs'), '--cwd', root, ...(extra ?? [])], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, STUB_LOG: log, STUB_MODE: mode } });
  return { root, log, run };
}

test('audit process pins settings and accepts no author reports', () => {
  const fixture = auditFixture();
  const result = fixture.run();
  assert.equal(result.status, 0, result.stderr);
  const captured = JSON.parse(readFileSync(fixture.log, 'utf8'));
  assert.equal(captured.args[captured.args.indexOf('-m') + 1], 'gpt-6.1-sol');
  assert.ok(captured.args.includes('model_reasoning_effort="xhigh"'));
  assert.ok(captured.args.includes('read-only'));
  assert.ok(captured.args.includes('agents.enabled=false'));
  assert.match(captured.prompt, /Skip `\.dev-team\/` apart from the plan/);
  assert.match(result.stdout, /## Engine[\s\S]*## Findings[\s\S]*## Verdict\npass/);
  const changed = fixture.run(['--effort', 'high']);
  assert.equal(changed.status, 0, changed.stderr);
  assert.ok(JSON.parse(readFileSync(fixture.log, 'utf8')).args.includes('model_reasoning_effort="high"'));
});

test('audit failures and unsupported settings never fall back', () => {
  for (const mode of ['fail', 'bad', 'timeout']) {
    const fixture = auditFixture(mode);
    const result = fixture.run(mode === 'timeout' ? ['--timeout', '0.1'] : []);
    assert.equal(result.status, 4, result.stderr);
    assert.match(result.stderr, /^Audit failed:/);
    assert.equal(result.stdout, '');
  }
  const fixture = auditFixture();
  assert.equal(fixture.run(['--model', 'unknown']).status, 2);
  assert.equal(existsSync(fixture.log), false);
  assert.equal(fixture.run(['--target', 'plan', '--plan', 'missing.md']).status, 2);
  assert.equal(existsSync(fixture.log), false);
});
