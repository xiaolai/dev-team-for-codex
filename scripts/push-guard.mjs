import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function deny(reason) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }) + '\n');
}

try {
  const { publishKind } = await import('./lib.mjs');
  const { readOnlyCommand } = await import('./read-only-command.mjs');
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (!input || typeof input !== 'object' || typeof input.tool_name !== 'string') throw new Error('invalid hook input');
  const role = input.agent_type;
  const child = Boolean(role || input.agent_id);
  const tool = input.tool_name;
  const command = input.tool_input?.command;
  const team = typeof role === 'string' && role.startsWith('dev_team_');
  const readers = new Set(['dev_team_scout', 'dev_team_planner', 'dev_team_auditor', 'dev_team_consultant']);
  const readTools = new Set(['Bash', 'Read', 'Grep', 'Glob', 'view_image', 'update_plan', 'WebSearch', 'WebFetch', 'web_search', 'web__run']);
  if (tool === 'Bash' && command === 'printf DEV_TEAM_GUARD_PROBE') {
    deny(`dev-team: guard active for ${role ?? (child ? 'unknown-child' : 'main')}`);
  } else if (team && (/spawn_agent$/.test(tool) || tool === 'Agent' || tool.startsWith('mcp__'))) {
    deny('dev-team: role agents cannot spawn children or call MCP tools; return the requirement to the orchestrator.');
  } else if (readers.has(role) && !readTools.has(tool)) {
    deny(`dev-team: ${role} is read-only; ${tool} is outside its supported read tools.`);
  } else if (child && tool === 'Bash') {
    if (typeof command !== 'string') throw new Error('missing shell command');
    if (/^\s*(?:\S*\/)?(?:ba|z|fi|da)?sh\s*$/.test(command) || /^\s*(?:python[\d.]*|node|ruby|irb)\s*$/.test(command)) {
      deny('dev-team: interactive interpreters are not supported; use a complete noninteractive command.');
    } else {
      const kind = publishKind(command);
      if (kind && role !== 'dev_team_releaser') deny(`dev-team: ${role ?? 'unknown-child'} may not publish (${kind}); dispatch dev_team_releaser only with user authorization.`);
      else if (readers.has(role)) {
        try {
          readOnlyCommand(command);
        } catch (error) {
          error.readPolicy = true;
          throw error;
        }
        const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
        const wrapper = join(import.meta.dirname, 'read-only-shell.mjs');
        const updated = `${quote(process.execPath)} ${quote(wrapper)} ${quote(Buffer.from(command).toString('base64'))}`;
        process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { ...input.tool_input, command: updated } } }) + '\n');
      }
    }
  }
} catch (error) {
  deny(error.readPolicy ? `dev-team: read-only policy blocked this command: ${error.message}` : `dev-team: guard failed (${error.message}); this call is blocked.`);
}
