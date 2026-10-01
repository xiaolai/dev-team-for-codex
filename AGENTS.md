# dev-team for Codex

- Keep this package separate from the Claude plugin. Do not edit the source repository as part of this port.
- Run `node --test scripts/*.test.mjs` after changing helpers or contracts.
- `templates/agents/` contains seven standalone Codex agent TOMLs. The installer materializes these in each target repository's `.codex/agents/`.
- Agent TOML headers are the model/effort source of truth. Keep `model` and `model_reasoning_effort` before `developer_instructions` for the runner's deliberately limited header reader.
- Hooks belong to the plugin, not agent TOMLs. Preserve the guarded dynamic import and explicit denial on parsing/import failures.
- A missing `agent_type` with an `agent_id` is an unidentified child, never an authorized main session.
- Every role performs its harmless guard probe before work. Untrusted/skipped hooks must stop role work rather than silently weaken protection.
- Keep auditor contexts fresh and exclude tester/coder reports. Never substitute an engine or model after a failure.
- The coder does not edit tester-owned tests. Disputes stop for the user.
- Publishing needs a separate user request; do not infer it from a green audit.
- Describe the shell guard as accident prevention, not a security boundary. Record observed client versions and separate tests from unverified platform claims.
- Do not commit or publish unless requested. Honor applicable Jev requirements before readiness or commit-message judgments.
