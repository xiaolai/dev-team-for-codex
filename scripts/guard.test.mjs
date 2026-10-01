import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

function invoke(input, script = join(import.meta.dirname, 'push-guard.mjs')) {
  const result = spawnSync(process.execPath, [script], { input: JSON.stringify(input), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout).hookSpecificOutput : null;
}

const command = (text, role, extra = {}) => ({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: text }, ...(role ? { agent_type: role, agent_id: 'fixture-child' } : {}), ...extra });

test('publishing is denied to workers, allowed to main and releaser', () => {
  assert.equal(invoke(command('git push', 'dev_team_coder')).permissionDecision, 'deny');
  assert.equal(invoke(command('git push', 'dev_team_releaser')), null);
  assert.equal(invoke(command('git push')), null);
  assert.equal(invoke(command('npm test', 'dev_team_coder')), null);
});

test('unknown child identity never inherits the main-session exception', () => {
  assert.equal(invoke(command('git push', null, { agent_id: 'unknown-child' })).permissionDecision, 'deny');
  assert.equal(invoke(command('git push', 'unrelated_worker')).permissionDecision, 'deny');
});

test('role probes prove the hook ran and include the actual role', () => {
  const result = invoke(command('printf DEV_TEAM_GUARD_PROBE', 'dev_team_auditor'));
  assert.equal(result.permissionDecision, 'deny');
  assert.equal(result.permissionDecisionReason, 'dev-team: guard active for dev_team_auditor');
});

test('team roles cannot mutate through MCP, edit read-only roles, or spawn grandchildren', () => {
  for (const tool of ['mcp__github__push_files', 'spawn_agent', 'collaborationspawn_agent']) {
    assert.equal(invoke({ agent_type: 'dev_team_coder', tool_name: tool, tool_input: {} }).permissionDecision, 'deny');
  }
  assert.equal(invoke({ agent_type: 'dev_team_planner', tool_name: 'apply_patch', tool_input: {} }).permissionDecision, 'deny');
  assert.equal(invoke({ agent_type: 'dev_team_consultant', tool_name: 'image_gen__imagegen', tool_input: {} }).permissionDecision, 'deny');
  assert.equal(invoke({ agent_type: 'dev_team_coder', tool_name: 'apply_patch', tool_input: {} }), null);
});

test('malformed input and failed imports return explicit denials', () => {
  assert.equal(invoke(null).permissionDecision, 'deny');
  const directory = mkdtempSync(join(tmpdir(), 'dev-team-guard-'));
  const script = join(directory, 'push-guard.mjs');
  copyFileSync(join(import.meta.dirname, 'push-guard.mjs'), script);
  assert.equal(invoke(command('git push', 'dev_team_coder'), script).permissionDecision, 'deny');
});

test('read-only shell calls are rewritten, with the original command encoded losslessly', () => {
  const original = "rg 'a; $(touch unexpected)' README.md";
  const result = invoke(command(original, 'dev_team_auditor'));
  assert.equal(result.permissionDecision, 'allow');
  assert.match(result.updatedInput.command, /read-only-shell\.mjs/);
  const encoded = result.updatedInput.command.match(/'([^']+)'$/)[1];
  assert.equal(Buffer.from(encoded, 'base64').toString(), original);
});
