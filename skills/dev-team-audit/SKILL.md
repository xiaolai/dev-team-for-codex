---
name: dev-team-audit
description: Independently audit a local change or plan with Codex, using a fresh native auditor or an explicitly selected read-only Codex process with pinned model and reasoning effort.
---

Resolve `PACKAGE` two directories above this SKILL.md. Parse the user's request into target, base, plan, engine, and execution. Default target is diff, base HEAD, engine codex, execution native. Plan alone means target plan; base plus plan means diff against that plan. With no plan, let the auditor infer intent from the change; do not supply the author's explanation.

Reject any engine other than codex explicitly. Read the profile's Engine setting when the user did not choose an engine; reject an unsupported imported value instead of overriding it. Profiles are optional for standalone audits; report found/missing.

- Native: require the installed `dev_team_auditor` agent and trusted plugin hooks. Spawn it with fresh context, only target/base/plan/engine, and no coder/tester reports. Its TOML pins the model/effort; a prompt override will not reliably replace those values. Show its Engine, Findings, Verdict report unchanged.
- Process, only when selected: run `node "PACKAGE/scripts/codex-audit.mjs" --cwd "REPOSITORY" --target diff --base "BASE" --plan "PLAN"` with a tool timeout above the runner's 540-second default. For plan auditing use `--target plan --plan "PLAN"`; omit absent arguments. The runner reads the repository auditor TOML, or package defaults if not installed, and passes model/effort explicitly. A one-run pair can be selected using `--model MODEL --effort EFFORT`, after catalog validation. It uses a fresh process and read-only sandbox.

On `Audit failed:` or nonzero runner exit, state that no completed audit exists. Do not retry using another execution mode, engine, or model unless the user requests that change. A finding is not a request to fix it, commit it, or publish anything.
