import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = mkdtempSync(join(tmpdir(), 'dev-team-read-probe-'));
writeFileSync(join(directory, 'fixture.txt'), 'hello\n');
const client = process.env.DEV_TEAM_PROBE_CODEX ?? 'codex';
const checks = [];
for (const command of ['cat fixture.txt', 'rg --count hello fixture.txt', 'printf read-ok', 'printf bad > forbidden.txt', 'node -e "0"']) {
  const result = spawnSync(process.execPath, [join(import.meta.dirname, 'push-guard.mjs')], { input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', agent_type: 'dev_team_auditor', agent_id: 'fixture', tool_input: { command } }), encoding: 'utf8' });
  const decision = JSON.parse(result.stdout).hookSpecificOutput;
  if (decision.permissionDecision === 'deny') checks.push({ command, denied: true, reason: decision.permissionDecisionReason });
  else {
    const executed = spawnSync(client, ['sandbox', '-P', ':workspace', '-C', directory, '--', '/bin/sh', '-c', decision.updatedInput.command], { cwd: directory, encoding: 'utf8', timeout: 30000 });
    checks.push({ command, status: executed.status, stdout: executed.stdout, stderr: executed.stderr });
  }
}
const passed = checks[0].status === 0 && checks[0].stdout === 'hello\n' && checks[1].status === 0 && checks[1].stdout === '1\n' && checks[2].status === 0 && checks[2].stdout === 'read-ok' && checks[3].denied && checks[4].denied && !existsSync(join(directory, 'forbidden.txt'));
process.stdout.write(JSON.stringify({ directory, client, passed, checks }, null, 2) + '\n');
process.exitCode = passed ? 0 : 1;
