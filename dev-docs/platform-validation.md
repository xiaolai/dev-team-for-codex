# Platform validation — 2026-10-01

## Observed clients

- PATH CLI: `codex-cli 0.159.2`.
- Desktop: ChatGPT.app `26.928.21956`, build `12404`; bundled CLI reports `0.159.2`.
- A local app-server daemon `0.159.3` was also present; do not infer its behavior from the CLI version alone.
- macOS with Node and ripgrep available. No other OS was validated.

## Probes and decisions

| Probe | Observation | Implementation consequence |
|---|---|---|
| Custom role configuration | Agent loaded and its model differed from the parent as configured | Generate project agent TOMLs with explicit model and effort |
| Fresh context | Spawn hook showed `fork_turns: none`; child reported no parent-only nonce | Require explicit no-history dispatch; no default full-history forks |
| Role-local hooks | Custom agent loaded but its inline hook did not execute | Keep hooks at plugin scope |
| Shared hook identity | Child tool events contained both `agent_type` and `agent_id`; main events lacked them | Use observed identity; unknown child does not inherit main exemption |
| Shared explicit denial | PreToolUse denied the harmless marker and the child reported the denial | Every role performs a live hook probe |
| Parent read-only | Child write returned operation not permitted | Read-only worked in that parent mode |
| Parent workspace-write | Child with read-only TOML successfully wrote a fixture file | Do not rely on child sandbox configuration alone |
| Nested read-only sandbox | `codex sandbox -P :read-only` worked outside a sandbox, but nested execution failed at sandbox_apply | Reject this approach; a denial without successful reads is not usable isolation |
| Restricted read executor | Reads and write denials passed inside the real workspace sandbox with both CLI binaries; quoted substitutions stay literal | Limit native read-role shell capability to a small read-command set |
| Local plugin installation | Marketplace registration and plugin add succeeded in isolated homes with PATH and desktop-bundled binaries | Compatibility manifest and marketplace structure are usable on these binaries |
| Installed skill discovery | `codex debug prompt-input` exposed all three installed skill names in an isolated home | Skill registration works at the CLI prompt layer |

The fixture deliberately uses a customized scout model to distinguish it from the parent. It does not benchmark production role defaults or establish that every catalog entry can infer successfully.

## Reproduction

Run `node scripts/probe-native.mjs` for the current native guard/read test. It creates a temporary directory, performs real model requests, captures hook metadata, and prints a summary. It must demonstrate both successful reads and prevented writes. Raw temporary traces may include runtime metadata and are not packaged.

Run `node scripts/probe-package.mjs` for isolated registration and installation. Set `DEV_TEAM_PROBE_CODEX` to another installed binary to repeat either probe. No personal plugin installation is changed.

Run `node scripts/probe-read-tools.mjs` for the final guard-to-executor path inside `codex sandbox -P :workspace`, without inference. This passed using both installed client binaries. The final native-agent rerun and one retry timed out on model-catalog/workspace-routing discovery, so a live-child pass of the final restricted executor is not claimed.

## Independent forward testing

Final automated gate: `node --test scripts/*.test.mjs` — 40 passed, 0 failed. All seven TOMLs, plugin/marketplace JSON, all three skill validators, and whitespace checks passed.

An independent evaluator exercised setup, a scripted red-to-green task, lock behavior, tester snapshots, and process audits in disposable repositories. It found three reproducible defects: adopting unowned identical agents, separate locks from repository subdirectories, and missed test-symlink retargeting. Regression tests reproduced all three before fixes. The fixes preserve unowned files, canonicalize the Git worktree root, and snapshot both the logical test path's target and content.

The evaluator also exposed Git clean-filter execution during an ordinary diff and loss of backslashes in double-quoted patterns. Both were reproduced before fixing: the executor now enumerates and disables configured filter drivers for each Git read, and the tokenizer preserves ordinary double-quoted backslashes. Both have regression coverage.

The evaluator's final independent rerun confirmed all five reported defects fixed. That conclusion covers those reproduction cases, not untested platform behavior.

## Remaining limits

- Desktop UI discovery, hook trust controls, and a complete task through the desktop UI have not been verified.
- Normal persisted hook-trust approval is not exercised by the temporary native probe. It explicitly enables only the inspected probe hooks for that process.
- Effective child effort is configured and parsed; the observed hook payload reports model but not reasoning effort. A full runtime effort trace is still needed before claiming measured effort verification.
- Whole-team live execution, cross-client concurrent operation, every inherited tool path, and model-quality/latency benchmarking remain unverified. Scripted handoffs, unit tests, and model catalog entries do not establish these properties.
- Process auditing was covered with real subprocesses and stub models; nested live Codex sandbox behavior can fail and must remain a loud error.
- Command filtering is an accident-prevention control, not a hardened boundary against a malicious agent or repository. Read-role shell calls have a narrower supported grammar than general Bash.

## Official references

- [Subagents and configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Hook inputs, trust, and coverage](https://learn.chatgpt.com/docs/hooks)
- [Plugin packaging](https://developers.openai.com/plugins/build/plugins)
- [Model guidance](https://learn.chatgpt.com/docs/models)

The observed child identity fields extend the documented PreToolUse field table inspected during research. Preserve the probe rather than assuming that undocumented behavior will remain unchanged.
