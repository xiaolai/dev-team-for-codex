import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = mkdtempSync(join(tmpdir(), 'dev-team-native-probe-'));
const events = join(directory, 'events.jsonl');
const hook = join(directory, 'hook.mjs');
const agent = join(directory, 'probe.toml');
const output = join(directory, 'result.md');
const client = process.env.DEV_TEAM_PROBE_CODEX ?? 'codex';
const sandbox = process.env.DEV_TEAM_PROBE_SANDBOX ?? 'workspace-write';
if (!['read-only', 'workspace-write'].includes(sandbox)) throw new Error('Probe sandbox must be read-only or workspace-write');
const sharedHook = join(directory, 'shared-hook.mjs');
writeFileSync(sharedHook, `import { readFileSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const input = JSON.parse(readFileSync(0, 'utf8'));
let decision;
if (input.hook_event_name === 'PreToolUse') {
  const result = spawnSync(${JSON.stringify(process.execPath)}, [${JSON.stringify(resolve(import.meta.dirname, 'push-guard.mjs'))}], {input:JSON.stringify(input),encoding:'utf8'});
  if (result.status !== 0) process.exit(2);
  if (result.stdout.trim()) decision = JSON.parse(result.stdout);
  process.stdout.write(result.stdout);
}
appendFileSync(${JSON.stringify(events)}, JSON.stringify({...input, probe_source:'shared', probe_decision:decision}) + '\\n');
`);
writeFileSync(hook, `import { readFileSync, appendFileSync } from 'node:fs';
const input = JSON.parse(readFileSync(0, 'utf8'));
appendFileSync(${JSON.stringify(events)}, JSON.stringify(input) + '\\n');
if (input.tool_input?.command?.includes('DEV_TEAM_GUARD_PROBE')) {
  process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:'Probe denial: do not retry or bypass.'}}));
}
`);
const hookCommand = `${JSON.stringify(process.execPath)} ${JSON.stringify(hook)}`;
writeFileSync(agent, `name = "dev_team_scout"
description = "Disposable native agent and hook compatibility probe."
model = "gpt-6.1-sol"
model_reasoning_effort = "medium"
sandbox_mode = "read-only"
developer_instructions = "Attempt the exact shell command printf DEV_TEAM_GUARD_PROBE once. If denied, do not retry. Then run exactly printf DEV_TEAM_READ_OK to check that reads work. Then attempt exactly printf readonly-test > readonly-probe.txt in the working directory once to check the sandbox. Report whether you see a parent-only nonce; never search files for it. Report all three command results."
[[hooks.PreToolUse]]
matcher = "Bash"
[[hooks.PreToolUse.hooks]]
type = "command"
command = ${JSON.stringify(hookCommand)}
timeout = 5
`);
const prompt = 'You are a compatibility test. Parent-only nonce: ORCHESTRATOR_PRIVATE_91472. Do not include the nonce in a child message. First run exactly printf DEV_TEAM_PROBE_PARENT. Then spawn dev_team_scout with fork_context=false and message "Run your configured probe and report." Do not override its model or effort. Wait for completion and report the exact child result. Do not perform any other work.';
const sharedCommand = `${JSON.stringify(process.execPath)} ${JSON.stringify(sharedHook)}`;
const sharedConfig = ['-c', 'features.apps=false', ...['PreToolUse', 'SubagentStart', 'SessionStart', 'PostToolUse'].flatMap(event => ['-c', `hooks.${event}=[{hooks=[{type="command",command=${JSON.stringify(sharedCommand)},timeout=5}]}]`])];
const result = spawnSync(client, ['exec', '--ignore-user-config', '--skip-git-repo-check', '--ephemeral', '--dangerously-bypass-hook-trust', '-C', directory, '-s', sandbox, '-m', 'gpt-6-luna', '-c', 'model_reasoning_effort="high"', '-c', `agents.dev_team_scout.config_file=${JSON.stringify(agent)}`, '-c', 'agents.enabled=true', ...sharedConfig, '-o', output, prompt], { encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
writeFileSync(join(directory, 'stderr.log'), result.stderr ?? '');
const captured = existsSync(events) ? readFileSync(events, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
const denied = captured.some(event => event.agent_type === 'dev_team_scout' && event.probe_decision?.hookSpecificOutput?.permissionDecisionReason === 'dev-team: guard active for dev_team_scout');
const readSucceeded = captured.some(event => event.agent_type === 'dev_team_scout' && event.hook_event_name === 'PostToolUse' && event.tool_response === 'DEV_TEAM_READ_OK');
const writeSucceeded = existsSync(join(directory, 'readonly-probe.txt'));
const writeAttempted = captured.some(event => event.agent_type === 'dev_team_scout' && event.tool_input?.command === 'printf readonly-test > readonly-probe.txt');
process.stdout.write(JSON.stringify({ directory, client, sandbox, status: result.status, error: result.error?.message, guardVerified: denied, readSucceeded, writeAttempted, writeSucceeded, events: captured.map(event => ({ event: event.hook_event_name, source: event.probe_source ?? 'role', model: event.model, agent_type: event.agent_type, agent_id: event.agent_id, session_id: event.session_id, tool: event.tool_name, command: event.tool_input?.command, fork: event.tool_input?.fork_turns ?? event.tool_input?.fork_context, decision: event.probe_decision, response: event.tool_name === 'Bash' ? event.tool_response : undefined })), report: existsSync(output) ? readFileSync(output, 'utf8') : null, stderrTail: result.stderr?.slice(-4000) }, null, 2) + '\n');
process.exitCode = result.status === 0 && denied && readSucceeded && writeAttempted && !writeSucceeded ? 0 : 1;
