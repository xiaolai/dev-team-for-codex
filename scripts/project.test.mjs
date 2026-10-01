import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { installProject, readRoleSettings, roles } from './project.mjs';

const fixture = () => mkdtempSync(join(tmpdir(), 'dev team project '));

test('installation produces seven agents and is idempotent', () => {
  const directory = fixture();
  assert.equal(installProject(directory).written.length, 7);
  assert.equal(installProject(directory).written.length, 0);
  assert.equal(roles.length, 7);
  assert.deepEqual(readRoleSettings(directory, 'auditor'), { model: 'gpt-6.1-sol', effort: 'xhigh' });
});

test('preview does not write and customized agents prevent partial replacement', () => {
  const directory = fixture();
  assert.equal(installProject(directory, { check: true }).pending.length, 7);
  installProject(directory);
  const path = join(directory, '.codex/agents/dev_team_coder.toml');
  writeFileSync(path, 'user customization');
  assert.throws(() => installProject(directory), /customized|conflict/);
  assert.equal(readFileSync(path, 'utf8'), 'user customization');
});

test('uninstall preserves customized files and profiles', () => {
  const directory = fixture();
  installProject(directory);
  const profile = join(directory, '.codex/dev-team.md');
  writeFileSync(profile, 'reviewed profile');
  const path = join(directory, '.codex/agents/dev_team_coder.toml');
  writeFileSync(path, 'user customization');
  const result = installProject(directory, { uninstall: true });
  assert.equal(result.removed.length, 6);
  assert.equal(result.preserved.length, 1);
  assert.equal(readFileSync(profile, 'utf8'), 'reviewed profile');
  assert.equal(readFileSync(path, 'utf8'), 'user customization');
});

test('refuses symlinked project config paths', () => {
  const directory = fixture();
  const outside = fixture();
  mkdirSync(join(directory, '.codex'));
  symlinkSync(outside, join(directory, '.codex/agents'));
  assert.throws(() => installProject(directory), /symlink/);
});

test('reads model choices from generated TOML headers and rejects invalid effort', () => {
  const directory = fixture();
  installProject(directory);
  const path = join(directory, '.codex/agents/dev_team_auditor.toml');
  writeFileSync(path, readFileSync(path, 'utf8').replace('model_reasoning_effort = "xhigh"', 'model_reasoning_effort = "imaginary"'));
  assert.throws(() => readRoleSettings(directory, 'auditor'), /effort/);
});

test('an identical pre-existing agent is never adopted or deleted', () => {
  const directory = fixture();
  mkdirSync(join(directory, '.codex/agents'), { recursive: true });
  const path = join(directory, '.codex/agents/dev_team_coder.toml');
  const template = readFileSync(join(import.meta.dirname, '../templates/agents/dev_team_coder.toml'), 'utf8');
  writeFileSync(path, template);
  assert.equal(installProject(directory).written.length, 6);
  installProject(directory, { uninstall: true });
  assert.equal(readFileSync(path, 'utf8'), template);
});
