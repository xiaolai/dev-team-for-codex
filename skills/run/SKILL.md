---
name: run
description: Build a feature or fix with separate Codex planner, tester, coder, and auditor contexts, a repository profile, tests-first gates, and bounded correction rounds.
---

You orchestrate the team; delegate role work rather than impersonating roles in your own context. Resolve `PACKAGE` two directories above this skill file. The user's request is the task; no Claude `$ARGUMENTS` substitution is used.

## Preconditions

- Require `.codex/dev-team.md`; suggest dev-team:init if missing. Run `node "PACKAGE/scripts/doctor.mjs" --cwd "REPOSITORY"`. Require discovery of all seven `dev_team_*` agents in a fresh session. Do not fall back to generic agents when a configured role is unavailable.
- Use the parent client's normal workspace-write permissions, not Full Access/bypass sandbox mode. Agent sandbox defaults do not override every live parent permission choice. Explain an unsupported mode and stop rather than changing it silently.
- Run exactly `printf DEV_TEAM_GUARD_PROBE` once in the main session; require the hook denial naming main. Every role independently performs its configured probe. A missing/failed probe stops the run.
- Check `git status --porcelain`. If dirty, explain that existing changes enter the audit and obtain consent; pass `--allow-dirty` only after that consent. Choose small only for one/two files with no interface or persisted-data change; otherwise standard. Read `Plan audit:` from the profile (auto if absent).
- Start with `node "PACKAGE/scripts/run-state.mjs" start --cwd "REPOSITORY" --size small --plan-audit auto`, substituting the actual choices. It returns an absolute run directory and base commit. Save the task as `task.md` there. The helper's per-worktree lock prevents another team run from starting concurrently.

## Dispatch and recording

Use explicit agent types and fresh context (`fork_context: false`, or the runtime's equivalent no-history option). Do not override pinned model/effort through a spawn request: TOML values take precedence. If freshness cannot be selected, stop and explain the missing capability.

Save each reply verbatim in the run directory. Record a stage with:

```text
node "PACKAGE/scripts/run-state.mjs" record --cwd "REPOSITORY" --run "RUN" --stage planner --outcome pass --report plan.md
```

Use the actual stage, outcome, and report basename. `pass` means the stage met its gate, not merely that its agent returned. `fail` is an ordinary gate failure; `error` is a role/engine/setup failure and stops immediately. A blocked state is terminal until the user chooses a new course; do not bypass it by creating another run.

| Stage | Agent and permitted inputs | Report and gate |
|---|---|---|
| scout, standard only | `dev_team_scout`: task | `brief.md`; evidence-based survey completed |
| planner | `dev_team_planner`: task, brief if any | `plan.md`; numbered checkable criteria, size, hard-to-reverse assessment |
| plan-audit, when needed | `dev_team_auditor`: target plan, latest plan only | `plan-audit-1.md`; pass verdict |
| tester | `dev_team_tester`: plan, brief if any | `tests.md`; every new test fails for the specified missing behavior, or documented manual criterion |
| coder | `dev_team_coder`: plan, tests report, latest audit on fixes | `code-1.md`; new tests and full profile gate pass |
| audit | `dev_team_auditor`: target diff, captured base, latest plan only | `audit-1.md`; pass verdict |

When the planner marks hard-to-reverse, add `--hard-to-reverse` to its record command. Auto then requires plan auditing; always/never obey the profile. A plan-audit failure allows one planner revision and one re-audit. Tester failure allows one correction. A valid diff-audit fail allows at most two coder fix rounds, each followed by a fresh audit. Role errors and coder gate failures stop immediately. The state helper enforces these bounds.

Before recording a successful tester stage, save `test-paths.json` containing the repository-relative paths of every tester-created or modified test/fixture; pass `--tests test-paths.json` with that record. Use `[]` only when the tester explicitly reports manual-only criteria. The helper snapshots file contents and checks them after every coder round. A disputed or modified test stops for the user; do not repair or overwrite it yourself.

Consultant questions go to fresh `dev_team_consultant` contexts and `consult-N.md`. Give resulting factual answers to the planner for revision before recording the accepted plan. Questions requiring the user wait for their answer. If a small task becomes standard, stop active agents, abort the current state with its reason, then restart as standard; keep the first run's evidence and explain the sizing correction.

## Independent audits

Never pass tester/coder reports, summaries, parent context, or the entire handoff directory to the auditor. `.dev-team/.gitignore` is an indexing exclusion, not filesystem access control. An audit receives the exact plan path and change scope only. Ensure untracked product files are included.

Default execution is native Codex. If the user explicitly selects process execution, use `PACKAGE/scripts/codex-audit.mjs` with target/base/plan/cwd; save its output verbatim. A failed process audit ends the run; never replace it with a native audit. `engine: claude` is unsupported in this port and fails explicitly.

## Interruption, reporting, release

After interruption, inspect `run.json`, reports, Git state, active children, and tester hashes. There is no automatic resume or lock stealing. Stop all active role agents before `run-state.mjs abort --cwd "REPOSITORY" --run "RUN" --reason "reason"`. Preserve reports and explain any required restart; never replay release actions.

End with a step/role/report/outcome table, final gate commands and exit codes, audit engine/model/effort, unresolved findings, and run directory. Close completed agent threads.

Release is never an automatic stage. Only on a separate user request, dispatch fresh `dev_team_releaser` with the change summary. Include `push: approved by the user` only when that authorization actually exists in the conversation. Applicable AGENTS.md and Jev checks still apply.
