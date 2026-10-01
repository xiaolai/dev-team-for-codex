# dev-team for Codex

A local Codex plugin for CLI and desktop: seven separate role contexts, explicit models and reasoning effort, tests before implementation, independent audits, and a bounded fix loop.

This is the Codex port of `dev-team-for-claude`. The Claude package remains separate. Runtime evidence and current limitations are in [platform validation](dev-docs/platform-validation.md).

## Install

Requires macOS, Node.js >=20.11, `rg`, and Codex CLI >=0.159.2 on PATH, authenticated for the selected models. The macOS CLI and desktop-bundled CLI were probed; other operating systems are not validated.

```sh
codex plugin marketplace add xiaolai/dev-team-for-codex
codex plugin add dev-team@xiaolai-dev-team
```

In CLI, review and trust the plugin hook through `/hooks`. In desktop, enable the plugin and use its hook-review controls. Installation alone does not trust hooks. Open a fresh session in the repository you want the team to work on, then select the **dev-team:init** skill or ask:

```text
Use dev-team:init to set up this repository.
```

Initialization installs `.codex/agents/dev_team_*.toml` and drafts `.codex/dev-team.md`. Review its commands, protected paths, and release steps. Open another fresh session after agent installation so the runtime discovers the new roles. Do not assume Claude's `/dev-team:init` slash command exists in Codex; use the installed skill picker or the names above.

For every initialized repository, keep this plugin enabled. The generated agents intentionally stop if its hook is absent or untrusted. The installation helpers do not edit personal Codex configuration.

## Use

```text
Use dev-team:run to add rate limiting to the API.
Use dev-team:audit to review changes against main.
Use dev-team:audit on the plan at dev-docs/feature-plan.md.
Use dev-team:audit with process execution, base main.
```

The main session orchestrates scout → planner → optional plan audit → tester → coder → auditor. Small tasks skip only the scout. Consultant questions go through their own fresh context. A plan gets one revision after a failed plan audit; invalid red runs get one correction; failed diff audits get at most two coder fix rounds. An engine error or failed implementation gate stops immediately.

Reports live under ignored `.dev-team/<run-id>/`. `run.json` records stage outcomes and report hashes. A canonical worktree lock prevents overlapping team runs, including invocation from a subdirectory. Tester-owned files are snapshotted with content hashes and resolved targets; coder changes or symlink retargeting stop the run without overwriting evidence.

Release is separate and requires the user's request. Only `dev_team_releaser` is exempt from the subagent publishing guard; pushing still requires explicit user authorization. Applicable repository checks, including Jev where required, remain in force.

## Models and effort

| Role | Model | Effort | Capabilities |
|---|---|---|---|
| Scout | `gpt-6-luna` | high | Repository reads |
| Planner | `gpt-6.1-sol` | high | Repository reads, planning |
| Tester | `gpt-6.1-sol` | high | Test edits, shell |
| Coder | `gpt-6.1-sol` | medium | Implementation edits, shell |
| Auditor | `gpt-6.1-sol` | xhigh | Repository reads, independent review |
| Releaser | `gpt-6-luna` | medium | Release edits, shell, authorized publishing |
| Consultant | `gpt-6.1-sol` | high | Repository reads, native web research |

These are initial defaults, not benchmark winners. The main-session recommendation is Sol/medium; the plugin does not change the user's selected main model.

Customize the generated TOML header in the target repository, keeping these fields before `developer_instructions`:

```toml
model = "gpt-6-astra"
model_reasoning_effort = "high"
```

For example, use that pair for a demanding auditor, or raise the planner to Sol/xhigh for migrations. Agent-file settings take precedence over spawn overrides, so a request saying “use another model” does not replace a contradictory pinned TOML. Reopen the session after editing agent configuration.

Run `node /path/to/plugin/scripts/doctor.mjs --cwd /path/to/repo` to check all seven pairs against the advertised catalog. A missing or unsupported model fails explicitly. The process audit runner also accepts `--model` and `--effort` for a single audit without modifying shared configuration. No engine/model fallback occurs after a failure.

## Permission behavior

The plugin hook distinguishes the main session from children using the runtime's observed `agent_type`/`agent_id` fields. Every role first attempts an intentionally denied `printf DEV_TEAM_GUARD_PROBE`; a skipped hook cannot silently pass that check. Hook behavior must be rechecked after client upgrades.

On the probed runtime, parent workspace-write settings can override a child's read-only TOML. Read-only roles therefore cannot use arbitrary shell commands. Their hook permits only `cat`, `ls`, `pwd`, `head`, `tail`, `wc`, `printf`, `rg`, numbered `sed -n` reads, and selected read-only Git subcommands. It rewrites approved calls to an argv executor with no shell or stdin, disabling configured Git filters, external diff/textconv/fsmonitor helpers, and rg preprocessors. Pipes, redirection, interpreters, and shell expansion are rejected. Unsupported checks go back to the orchestrator. Native file edits, child spawning, and MCP calls are denied for the relevant roles.

The publishing lexer prevents accidental direct publishing. It is not a complete security boundary: opaque scripts and tools outside hook coverage can perform side effects. `write_stdin` does not receive another pre-tool hook; roles must not use interactive interpreters or feed commands into existing sessions. The main session remains unaffected except for its explicit diagnostic probe.

Hook startup failures outside the script, missing Node, untrusted hooks, and runtime timeouts cannot be made universally fail-closed by a plugin. Role preflight must stop when guard verification fails. Do not use Full Access for team runs.

## Audit execution

Native auditing uses a fresh `dev_team_auditor` context with only the plan and change scope. Ignoring `.dev-team/` keeps reports out of Git listings; it does not make them unreadable. The instructions explicitly exclude coder/tester reports.

Process execution is selected explicitly and launches `codex exec` with a pinned model/effort and read-only sandbox. The runner reports failure on missing Codex, timeout, nonzero exit, unsupported settings, or an incomplete verdict. Launching a second sandboxed Codex from a sandboxed parent can fail on some clients; that is an error, never a reason to retry unsandboxed or silently switch execution modes. `engine: claude` is not implemented in this port.

## Refresh, interruption, and removal

Reinstall the plugin after updating its cached package, then use init to preview agent refreshes. Customized and unowned agent files are never overwritten automatically; an identical pre-existing file is not adopted. Profiles remain user-owned. Resolve customization conflicts explicitly.

Interrupted runs are inspectable through `run-state.mjs status`. There is no automatic resume, stale-lock stealing, or publication replay. Stop active role agents before using `abort --reason ...`; then review the repository and start a new run if requested.

```sh
node /path/to/plugin/scripts/install.mjs --cwd /path/to/repo --uninstall
codex plugin remove dev-team@xiaolai-dev-team
```

The first command removes only unchanged owned agent files; it preserves customized agents and the profile. The second removes the plugin installation.

## Development checks

```sh
node --test scripts/*.test.mjs
node scripts/probe-package.mjs
node scripts/probe-read-tools.mjs
node scripts/probe-native.mjs
```

The native probe performs real model requests in a disposable directory. It uses a hook-trust bypass only for its inspected temporary probe configuration; normal plugin execution does not. `DEV_TEAM_PROBE_CODEX` can select another client binary. The package probe uses an isolated temporary `CODEX_HOME` and does not alter the user's plugin installation.

The implementation plan is under `dev-docs/codex-plans/`. Desktop UI smoke testing and repeated model-quality comparisons remain separate validation work; successful binary-level probes do not establish them.
