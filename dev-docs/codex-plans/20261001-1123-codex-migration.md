---
title: "Dev-team migration to Codex CLI and desktop"
created_at: "2026-10-01 11:23 Asia/Shanghai"
mode: "full-plan"
status: "Version 0.1.0 implemented locally; validation coverage and remaining gates recorded separately"
---

## Implementation Reconciliation — 2026-10-01

Xiaolai selected `~/github/xiaolai/myprojects/codex-plugins/dev-team` as the destination. Paths below originally prefixed with `codex/` now refer to this package root; the Claude package is unchanged.

WI-002 through WI-006 have a first implementation and automated coverage. WI-001 established fresh-context dispatch, shared-hook child identity, and the parent-permission override; it also rejected role-local hooks and nested OS sandboxing. Native read roles now use a restricted direct-argv read executor, because read-only TOMLs alone did not constrain a workspace-write parent's child.

The installer preserves customized/unowned files. Model choices are pinned in TOMLs; unsupported catalog pairs fail explicitly. Run state enforces stage ordering, retry bounds, a canonical worktree lock, and test-file content/target snapshots. Interrupted runs are inspected and explicitly aborted/restarted; automatic resume was deferred to avoid replaying effects.

WI-007 remains partial: desktop UI end-to-end use, all-role live workflows, effective child-effort traces, and repeated model-quality benchmarks are not yet established. See `dev-docs/platform-validation.md` for measured behavior and limitations. Do not interpret the original acceptance criteria below as completed simply because code and stub tests exist.

## Outcomes

Deliver a locally installed Codex plugin usable from both CLI and desktop, preserving seven separate roles, tests before implementation, independent audits, bounded retries, repository profiles, and explicit release authorization.

Recommended architecture: a Codex plugin containing three entry skills, role templates, and helpers; initialization materializes seven project-scoped TOML agents. Use native agent threads when their isolation and permissions pass the probes below. Keep the existing fresh-process Codex audit path available as an explicitly selected execution mode.

This document is the research-and-plan deliverable. It does not install a plugin, change personal configuration, migrate a profile, or implement the port. Public directory submission and hosted/web execution are outside the initial scope.

## Constraints & Dependencies

- Baseline inspected: Codex CLI 0.159.2; plugins, hooks, and multi-agent features report stable/enabled. Treat this as the probe baseline, not proof that every feature below works.
- Installed desktop: ChatGPT.app 26.928.21956, build 12404. Current official documentation describes local Codex in this desktop app. Desktop behavior was not exercised during research; CLI version does not establish the desktop engine version.
- Node.js >=20.11 remains the helper/test requirement. Use the existing CLI authentication; no new API-backed orchestration service is proposed.
- Project configuration and plugin hooks require their respective trust setup. A plugin being installed does not imply its hooks are active.
- Preserve the Claude package and its existing profile behavior while developing the Codex package in a separate `codex-plugins/dev-team` repository directory.
- No global agent names or personal settings are overwritten by initialization. Target repositories receive only explicitly owned project artifacts.
- Model catalog discovery is evidence of advertised settings, not proof of successful model inference or comparative quality.

## Research Evidence

Sources retrieved on 2026-10-01:

1. [Plugin packaging](https://developers.openai.com/plugins/build/plugins): local marketplace distribution works across supported local clients; portable root manifests are recommended, while `.codex-plugin/plugin.json` remains supported. Plugin packages do not document automatic installation of custom agent TOMLs.
2. [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents): custom agents live in project or personal `.codex/agents/`; TOMLs define `name`, `description`, and `developer_instructions`, with optional model and effort. Agent-file values override resolved spawn/default values. Parent runtime permission overrides can be reapplied to children.
3. [Hooks](https://learn.chatgpt.com/docs/hooks): command hooks need trust; shell/unified-exec calls match `Bash`; `PreToolUse` can deny calls. Its documented fields do not include `agent_type`. `SubagentStart` has agent identity, but common hook `session_id` uses the parent session for subagents. `write_stdin` does not receive another pre-tool check.
4. [Models](https://learn.chatgpt.com/docs/models): Sol is recommended for complex coding; Luna for focused work. Higher effort trades time/tokens for reasoning. Ultra can add delegation.
5. [Claude plugin migration](https://developers.openai.com/plugins/guides/submit-claude-plugin): Claude agent Markdown needs adaptation; copying the directory does not preserve native agent semantics.

Local evidence:

- `codex --version`, `codex features list`, `codex plugin add --help`, and `codex debug models` were inspected.
- The catalog lists `gpt-6.1-sol`, `gpt-6-astra`, and `gpt-6-luna`. Sol/Astra list low, medium, high, xhigh, max, ultra; Luna lists low through max. No inference benchmark was run.
- `node --test scripts/*.test.mjs`: 20 passed, 0 failed. Existing tests exercise helpers and stub processes, not live Codex plugin semantics.
- Initial working tree was clean. No relevant prior memory entry was found.

## Current Behavior Inventory

| Area | Current implementation | Migration consequence |
|---|---|---|
| Packaging | `.claude-plugin/plugin.json`, marketplace | Add a separately loadable Codex package and marketplace entry |
| Roles | Seven `agents/_*.md`, Claude model/effort/tool frontmatter | Translate role contracts to Codex TOML; tools require separate validation |
| Entry points | `skills/init`, `run`, `audit`; `$ARGUMENTS` and Claude dispatch names | Rewrite invocation and dispatch against the installed Codex skill/agent names |
| Repository knowledge | `.claude/dev-team.md` | Add Codex profile with explicit import compatibility |
| Orchestration | Main session, serial write stages, bounded correction loops | Preserve gates and fresh handoffs, close completed threads |
| Audit isolation | Plan/change only; ignored `.dev-team/` reports | Verify clean spawn input; ignored files remain readable and are not a sandbox |
| Publishing | `push-guard.mjs` reads `agent_type`; missing identity means main session | Direct reuse is unsafe if Codex omits that field |
| External audit | `codex-audit.mjs`, fresh `codex exec`, read-only sandbox | Useful existing seam, but currently inherits model/effort because neither is passed |

Preserve the existing section labels as an interface. Keep missing-profile behavior per role, the three-section auditor report or single `Audit failed:` line, and the ban on coder edits to tester-owned tests.

## Target Rules

### Packaging and setup

1. Put the Codex package at the new repository root, initially using the supported `.codex-plugin/plugin.json` compatibility format and explicit skills/hooks paths. This avoids accidentally loading the Claude skills or Claude hook. Reconsider a portable root manifest after the installed baseline passes a packaging probe.
2. Package three skills: `init`, `run`, `audit` (qualified as `dev-team:init`, `dev-team:run`, `dev-team:audit`). Record the actual installed names and invocation syntax from both clients; do not promise Claude slash-command aliases. Explicit skill selection and natural-language invocation must both reach the intended workflow.
3. Store reusable TOML templates in the package, then materialize `.codex/agents/dev_team_<role>.toml` in a target repository. Do not assume plugin-local `agents/` is automatically registered. Initialization uses a bootstrap explorer before custom roles exist; require a fresh session if discovery does not reload.
4. Resolve helper paths relative to the loaded skill/package. Hook commands may use documented `PLUGIN_ROOT`; do not assume that environment substitution also occurs in agent instructions.
5. Setup checks model availability, agent discovery, hook activation, sandbox behavior, and the CLI dependency. Missing prerequisites produce a precise setup failure, not a degraded team run.

### Models and effort

These are initial engineering defaults to evaluate, not measured winners or a mechanical translation of Claude effort labels.

| Role | Proposed model | Effort | Reason / escalation |
|---|---|---|---|
| Main orchestrator | `gpt-6.1-sol` | medium | Track gates and handoffs; recommend in UI/launch instructions, do not silently change the user's main session |
| Scout | `gpt-6-luna` | high | Efficient model with enough reasoning to trace code; compare medium during calibration |
| Planner | `gpt-6.1-sol` | high | Acceptance criteria and edge cases; xhigh for migrations/security/API changes |
| Tester | `gpt-6.1-sol` | high | Independent tests, meaningful failures, adversarial cases |
| Coder | `gpt-6.1-sol` | medium | Implement an already specified plan; high for demonstrated complexity |
| Auditor | `gpt-6.1-sol` | xhigh | Refute-mode review; Astra high is an optional quality preset |
| Releaser | `gpt-6-luna` | medium | Mechanical, exact execution; permissions and deterministic checks carry authorization |
| Consultant | `gpt-6.1-sol` | high | Primary-source research and tradeoffs; xhigh when explicitly justified |

Default effort is always explicit in role TOMLs. Do not default to max/ultra: the workflow controls delegation and retries itself. Different GPT models do not establish independent model-family review; optional Claude-engine support would need its own tested adapter.

Example generated file, subject to the WI-001 load probe:

```toml
name = "dev_team_auditor"
description = "Independent refute-mode audit of the plan and change."
model = "gpt-6.1-sol"
model_reasoning_effort = "xhigh"
sandbox_mode = "read-only"
developer_instructions = """
Read .codex/dev-team.md. Audit only the supplied plan and repository change.
Do not read coder/tester reports. Return Engine, Findings, and Verdict sections.
"""
```

The real template must contain the full current role contract. This example is not sufficient implementation.

Codex precedence matters: agent-file model/effort overrides explicit spawn settings. Consequently, a task override must not merely be written in the dispatch prompt while a contradictory TOML remains pinned. Initial release supports persistent per-repository choices in TOMLs. A one-run override either uses a predeclared variant agent or the explicit subprocess runner; never rewrite a shared TOML during an active run.

The runner must pass the resolved pair explicitly, equivalent to `codex exec -m gpt-6.1-sol -c 'model_reasoning_effort="xhigh"' -s read-only ...`. Record requested and observed settings where runtime evidence is available. Unsupported choices stop before work; no automatic model/engine substitution.

### Context, permissions, and release gates

1. Each role starts with only its allowed inputs. Audit dispatch must use a fresh context, not a fork containing the orchestrator's coder/tester reports. Probe the actual spawn interface and initial transcript; do not assume a particular clean-context parameter exists.
2. If native clean-context dispatch cannot be established, use a configured fresh-process audit mode and test its input. Never silently switch the selected mode after a failure.
3. Native read-only agent settings alone are insufficient evidence: test under the actual parent permission modes because live parent overrides can supersede defaults. Shell sandboxing also does not automatically prohibit write-capable remote MCP tools. Restrict inherited write tools or stop the affected role.
4. Adapt the publishing lexer, not its Claude identity assumption. Missing/unknown identity must not mean authorized releaser. Do not infer identity from model name, a prompt saying “I am releaser,” or parent `session_id` alone.
5. WI-001 must establish a trustworthy per-role policy route: role-local hooks with fixed deny policy, or an observed runtime identity mechanism. A shared parent-session map is insufficient for concurrent children. Test inheritance into grandchildren and auxiliary CLI processes.
6. A denied publishing command, guard import error, malformed input, missing runtime, timeout, untrusted hook, and interactive-shell bypass must be covered. Hook errors can fail open at the runtime layer; keep explicit denials for caught failures and refuse team mode when required protection is not active.
7. Treat shell lexical filtering as a guardrail against accidental publishing, not a complete security sandbox. `write_stdin`, opaque scripts, direct network calls, and unrelated write tools need explicit capability coverage. Do not claim full parity beyond measured coverage.
8. If native role enforcement cannot preserve the current contract, stop the parity milestone. Present a separately designed restricted runner as the next option. Do not silently replace “only releaser subagent publishes; main session unaffected” with “all publishing disabled.” A preview without release must be clearly labeled incomplete.
9. Release remains a separate user request with explicit push authorization. Respect applicable repository Jev instructions: secret-scan before reporting commit/push/publish readiness and commit-message docket before judging the proposed message. A model's confidence never grants publishing permission.

### Workflow and persistence

- Preserve scout sizing, mandatory planner/tester, optional consultant and plan audit, one plan revision, one tester correction, and at most two coder fix rounds.
- Keep serial write stages. Use a per-worktree active-run lock to prevent two clients from modifying the same working tree concurrently.
- Snapshot tester-owned file hashes after the accepted red run; compare after coder work. On edits, stop and report without overwriting user changes. This detects a violation rather than preventing arbitrary shell writes.
- Preserve dirty-tree consent, capture base commit plus initial dirty paths, and include untracked product files in the audit.
- Refreshes preserve user edits and require review of proposed profile changes. Resuming checks base, worktree, plan/test hashes, model selections, and last completed gate. Do not automatically repeat publishing after a crash.

## Data Model

- `.codex/dev-team.md`: reviewed repository facts; retain current section labels. New profiles default to Codex audit. Import `.claude/dev-team.md` by reviewed copy; retain the source unchanged. A conflicting engine value is surfaced rather than silently rewritten.
- `.codex/agents/dev_team_*.toml`: effective per-role model, effort, instructions, and supported capability settings. These are the model configuration source of truth; the Markdown profile should not duplicate editable model values.
- `.codex/dev-team-install.json`: versioned ownership manifest containing schema version, package version, installed paths, and generated hashes. Enables non-destructive refresh/uninstall.
- `.dev-team/.gitignore`: `*`, preserving the current behavior.
- `.dev-team/<run-id>/`: current reports plus versioned `run.json` containing base/worktree, current stage, report paths, selected engine/mode/model/effort, test hashes, attempts, exit codes, and terminal status. Use unique IDs beyond minute precision.
- Run states: running, blocked, failed, complete. A restart does not infer completion from an existing file or exit 0 without a valid report.

## Decision Log

- D1: Separate Codex package in this checkout. A destructive conversion would disrupt the working Claude plugin; a full separate repository now would add unnecessary distribution work. Repository extraction can happen later.
- D2: Native project agents plus skills are the preferred integration. Seven personas inside one skill lose independent contexts and actual model settings. A standalone API service adds auth and infrastructure unnecessary for local clients.
- D3: Project TOMLs are explicitly installed by init because plugin agent auto-registration is not established. Global installation would affect unrelated repositories and risk name collisions.
- D4: Pin model and effort per role; benchmark the table before freezing defaults. Do not rely on whichever model happens to be selected in the parent UI.
- D5: Native security/context parity is a blocking spike. A syntactically valid manifest does not prove the original workflow guarantees.
- D6: Retain the existing fresh-process Codex audit seam and hard engine failure. Optional Claude auditing in the Codex port is deferred until a separately tested adapter exists; selecting unsupported Claude fails explicitly.

## Gaps and Open Questions

| Gap | Decision owner / default | Resolution |
|---|---|---|
| Native fresh context and tool restriction semantics | Runtime evidence; no inferred parity | WI-001, WI-004 |
| Reliable release identity and hook failure behavior | Runtime evidence; block full-parity rollout if missing | WI-001, WI-005 |
| Native TOML reload and installed skill namespace | Runtime evidence; fresh session if required | WI-001, WI-002 |
| Desktop engine/config differs from CLI | Test installed desktop independently | WI-001, WI-007 |
| Role model quality/latency | Xiaolai can choose a quality preset; table is initial default | WI-003, WI-007 |
| Claude audit engine in the new package | Defer adapter; explicit unsupported-engine error | WI-004 |
| Shared vs separate distribution repository | Keep isolated package in this checkout initially | WI-002 |

No user decision blocks producing this plan. Runtime findings can change the implementation choice; document them before expanding implementation scope.

## Work Items

### WI-001: Probe installed Codex contracts

- Goal: Resolve the architectural uncertainties before the port.
- Priority / estimate: P0 / M.
- Tests first: `scripts/codex-platform-probe.test.mjs` and disposable fixture projects; capture agent discovery, observed model/effort, clean context, inherited permissions, hook inputs/denials/trust, nested agents, code-mode shell calls, interactive stdin, and desktop/CLI differences. Use stub publishing tools, never real publication.
- Acceptance: A versioned matrix reports pass/fail/unknown for each required invariant on each client. A report-only nonce in the parent is absent from auditor initial context. Read-only roles cannot modify a fixture through supported paths. Publishing authorization has evidence beyond prompt identity. Unknown mandatory guarantees block full parity.
- Touched areas: probe fixtures/scripts and `dev-docs/codex-platform.md`; disposable project configs, not personal config.
- Dependencies: CLI authentication and installed desktop; hooks need the runtime's legitimate trust flow.
- Risks / mitigation: Docs may be ahead of installed clients; use runtime evidence. If a test cannot be automated, record its exact manual steps and outputs.
- Rollback: Remove fixtures and disposable installations; restore any temporary test-client settings.

### WI-002: Package and initialize the Codex team

- Goal: Install three discoverable skills and seven owned project agents.
- Priority / estimate: P0 / M.
- Tests first: `scripts/codex-package.test.mjs`, `scripts/codex-init.test.mjs`; package paths, exact role count, TOML parsing, missing profile, reviewed import, idempotence, modified-file collisions, stale versions, paths with spaces, reload behavior.
- Acceptance: Both clients discover the same package; init produces seven uniquely named agents and a valid profile; a second unchanged init makes no edits; refresh never overwrites customized files without review.
- Touched areas: `codex/.codex-plugin/plugin.json`, `codex/skills/*`, `codex/templates/agents/*`, `codex/templates/dev-team.md`, `codex/scripts/init.mjs`, repo `.agents/plugins/marketplace.json`.
- Dependencies: WI-001 packaging/agent results. Inspect any parent marketplace before integrating; no automatic cross-repository edits.
- Risks / mitigation: Cached installs and command-name collisions; use tested refresh procedure and namespaced role names.
- Rollback: Remove only unchanged owned project files using the install manifest; preserve user edits and the Claude profile.

### WI-003: Resolve and validate role settings

- Goal: Make model/effort choices observable and repeatable.
- Priority / estimate: P0 / S.
- Tests first: `scripts/codex-models.test.mjs`; valid/invalid pairs, absent model, hidden model, stale catalog, unavailable refresh, generated TOML precedence, variant agents, explicit subprocess argv.
- Acceptance: All seven roles receive the configured pair; invalid or unavailable selections stop with actionable errors. Changing the parent model does not silently change pinned roles. At least one live request per selected pair confirms acceptance during validation.
- Touched areas: agent templates, `codex/scripts/models.mjs`, model table documentation, runner argument resolution.
- Dependencies: WI-001, WI-002.
- Risks / mitigation: Catalog drift and account-specific access; validate at setup/run, record evidence, never auto-substitute.
- Rollback: Restore previous generated agents only if unchanged since installation; keep earlier selectable preset.

### WI-004: Port orchestration and independent auditing

- Goal: Preserve every gate and report contract across native and explicitly configured process auditing.
- Priority / estimate: P0 / L.
- Tests first: `scripts/codex-workflow.test.mjs`, `scripts/codex-audit.test.mjs`; scripted role results cover small/standard paths, all retry limits, tester dispute, early passing tests, malformed reports, process failure/timeout, untracked files, forbidden report inputs, concurrent runs, cancellation/resume.
- Acceptance: Small tasks still run planner/tester; no audit before the full gate passes; every failed gate stops at the prescribed bound; auditor inputs exclude reports; selected engines never fall back; stored run state matches actual exits and outputs.
- Touched areas: `codex/skills/run/SKILL.md`, `codex/skills/audit/SKILL.md`, agent templates, `codex/scripts/run-state.mjs`, `codex/scripts/audit.mjs`. Reuse pure helper logic where verified; avoid changing Claude behavior.
- Dependencies: WI-001 through WI-003.
- Risks / mitigation: Native context inheritance or broad tool access; use only a proven mode, otherwise halt the parity claim. Locks prevent concurrent CLI/desktop writers.
- Rollback: Disable the new plugin; retain reports and stop active children without touching user changes.

### WI-005: Port publishing controls

- Goal: Preserve the authorized releaser exception and denial of other subagents on supported tool paths.
- Priority / estimate: P0 / L, conditional on WI-001.
- Tests first: `scripts/codex-guard.test.mjs`; reuse the existing adversarial lexer corpus and add absent/malformed identity, concurrent same-parent agents, wrong role, grandchildren, untrusted hooks, import failure, missing Node, timeouts, stdin commands, inherited MCP writes, and bypass permission modes.
- Acceptance: Disallowed fixture actions never execute; authorized releaser actions execute only after recorded user authorization; main-session behavior remains as specified. Required-hook absence is detected before team work. Document precise coverage and any unsupported runtime modes.
- Touched areas: `codex/hooks/hooks.json`, `codex/scripts/push-guard.mjs`, init/preflight and role templates; reuse `publishKind` without broad lexer redesign.
- Dependencies: WI-001 proven policy route, WI-002. If no route satisfies the contract, stop and propose a revised runtime design.
- Risks / mitigation: A prompt rule or filesystem-writable identity token is not sufficient enforcement. Do not declare the spike solved by a blanket deny or an unverified identity map.
- Rollback: Disable the Codex team integration; do not leave a seemingly active but untrusted guard.

### WI-006: Add reversible profile/config migration

- Goal: Enable existing Claude users to adopt the Codex package without losing customization.
- Priority / estimate: P1 / M.
- Tests first: `scripts/codex-migration.test.mjs`; missing/dual profiles, conflicting engine, edited generated agents, interrupted writes, invalid versions, unknown labels, uninstall ownership, worktrees.
- Acceptance: Profile labels remain intact; before/after changes are reviewable; partial writes recover; rollback preserves both user-owned settings and the original Claude installation.
- Touched areas: installer/migration helpers, ownership schema, migration docs.
- Dependencies: WI-002 through WI-005.
- Risks / mitigation: Divergent profiles; make active profile explicit in reports and never maintain hidden bidirectional synchronization.
- Rollback: Versioned backup restore and ownership-aware removal; no blanket directory deletion.

### WI-007: Validate both clients and calibrate defaults

- Goal: Establish a supported version matrix and measured model choices.
- Priority / estimate: P0 / M.
- Tests first: `scripts/codex-acceptance.test.mjs` plus manual desktop checklist; fixture tasks include a two-file fix, API change, intentionally disputed test, planted audit defect, failed engine, protected path, and release denial.
- Acceptance: Both clients complete equivalent fixtures with identical gate semantics. Run each calibration task three times per candidate pair; require no critical workflow violations and record completion rate, planted-defect detection, elapsed time, and usage when exposed. Compare coder medium/high, planner high/xhigh, scout medium/high, and auditor Sol xhigh/Astra high. Freeze defaults only after reviewing results.
- Touched areas: acceptance fixtures, README installation/model/limitations tables, platform evidence.
- Dependencies: WI-001 through WI-006.
- Risks / mitigation: Small benchmark noise and desktop UI variability; publish raw sample sizes, do not claim statistical superiority, and keep manual evidence distinct from automated tests.
- Rollback: Retain the last validated package/settings; disable new enablement on regressions.

Ordering: WI-001 first; WI-002 then WI-003; WI-004 and WI-005 can progress independently after their prerequisites, without concurrent edits to shared templates; WI-006 then WI-007.

## Migration Plan

1. Develop/probe in disposable target repositories, with the Claude package unchanged.
2. Install the Codex package from a local marketplace and review hook trust through the client.
3. Preview the generated profile and seven agent files; import existing profile facts only when explicitly selected. Write via temporary files and atomic rename after conflict checks.
4. Open a fresh session when discovery requires it; verify effective settings before the first team task.
5. Pilot a non-release task from CLI and desktop, then validate release controls against stubs.
6. Roll back via the ownership manifest; preserve reports and customized files. No database backfill/reindex is needed.

Post-migration invariants: exactly seven expected agents, preserved profile labels, no unresolved template placeholders, validated model/effort pairs, active tested hooks, clean auditor inputs, original Claude files unchanged, and no stale run lock.

## Testing Procedures

- Existing baseline and full automated gate: `node --test scripts/*.test.mjs`.
- During implementation, run each new test file first against missing behavior, then against its implementation. Use stub Codex and publishing binaries for deterministic process tests.
- Retain `claude plugin validate --strict .claude-plugin/plugin.json` when changes can affect Claude packaging or shared assets.
- Codex packaging: validate manifest/TOML contracts in tests, install into a disposable marketplace/client profile, verify actual discovery. Do not invent a `codex plugin validate` command; it was not present in the inspected CLI help.
- Run live model/context/hooks probes after integration changes and client upgrades. Avoid real push/publish in automated acceptance.
- Documentation-only plan validation: required sections, consecutive work items, per-item tests/acceptance, dependency consistency, and clean diff formatting. This plan is not an implementation completion claim.

## Rollout Plan

Stage 1: capability spike. Stage 2: local development preview. Stage 3: CLI and desktop pilot on fixtures. Stage 4: personal marketplace adoption after full-parity gates pass. Public distribution is a separate task.

Kill switches: unexpected publication, missing trusted guard, report leakage into auditor context, tester test modification, silent model/engine fallback, or resume repeating a side effect. Stop the active run and disable the new integration; retain evidence. Do not publish from a partially validated preview.

## Plan → Verify Handoff

Collect per WI: WI-001 version/payload/transcript matrix; WI-002 install/refresh diffs and client discovery; WI-003 requested/observed model pairs; WI-004 gate traces and isolation tests; WI-005 denied-call logs and stub invocation counts; WI-006 before/after/rollback fixtures; WI-007 benchmark records and desktop observations.

Required fixtures: clean and dirty Git repositories, spaced paths, existing customized profiles, generated-agent collisions, fake publishing binaries, missing/failed Codex, forbidden report nonces, protected tester files, concurrent client sessions, and interrupted run state. Sanitize fixture logs before sharing them.

## Manual Test Checklist

- [ ] CLI and desktop discover the same three skills and seven project agents.
- [ ] Fresh-session/reload requirements and the actual installed invocation syntax are documented.
- [ ] Each role uses its intended model/effort under a differently configured parent.
- [ ] Read-only roles stay read-only under the supported permission modes.
- [ ] Auditor starts without parent reports and observes untracked product files.
- [ ] Failed tests, disputed tests, failed audit engines, and exhausted retries stop correctly.
- [ ] Untrusted or changed hooks cannot masquerade as an enabled protected workflow.
- [ ] Unauthorized publishing reaches no stub; authorized releaser behavior is verified separately.
- [ ] Concurrent CLI/desktop writes are refused, and interrupted runs resume without repeating release actions.
- [ ] Refresh/uninstall preserves customized files and the working Claude plugin.
