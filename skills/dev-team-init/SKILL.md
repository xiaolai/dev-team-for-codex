---
name: dev-team-init
description: Set up or refresh dev-team in a local Git repository, installing seven Codex agents with explicit models and drafting a reviewed repository profile.
---

Set up the team in the user's target repository, not in the plugin cache. Resolve the package root two levels above this SKILL.md. Paths below named `PACKAGE` are placeholders for that resolved absolute path, not environment variables supplied by Codex.

1. Read the target repository's AGENTS.md. Run `node "PACKAGE/scripts/install.mjs" --cwd "REPOSITORY" --check`. Show any ownership conflict; never overwrite customized agents. Otherwise run the same command without `--check`. The helper installs project agents only; it does not alter global settings or install/trust the plugin itself.
2. Ensure this plugin is enabled and its hooks trusted. Use the client's hook review flow (`/hooks` in CLI); never bypass hook trust for ordinary use. Run exactly `printf DEV_TEAM_GUARD_PROBE` in the main session. Expect a hook denial saying `dev-team: guard active for main`. If it executes, stop setup with instructions to enable/trust the plugin. This is an intentional harmless denial, not an installation error.
3. Survey the repository with a fresh built-in explorer context; setup must not depend on newly installed agent discovery. Give it only a profile-survey request, requiring sources for test/lint/typecheck/build commands, conventions, protected paths, release/version locations, and commit-message conventions. No writes, installs, builds, or release actions from the survey agent.
4. Fill `PACKAGE/templates/dev-team.md` from that evidence. Write unknown and what was searched when evidence is absent. Preserve all section/interface labels. New profiles use `Engine: codex` and `Plan audit: auto`. If `.claude/dev-team.md` exists, offer a reviewed import of factual sections; retain the Claude file. An existing `.codex/dev-team.md` is refreshed only through shown before/after changes accepted by the user.
5. Run each safe check command once, with a ten-minute limit. Skip commands requiring network services, credentials, live servers, or writes beyond build output. Record dates, exit codes, and skip reasons; preserve failures.
6. Save `.codex/dev-team.md`, then run `node "PACKAGE/scripts/doctor.mjs" --cwd "REPOSITORY"`. It validates settings and the advertised model catalog, not hook trust or actual inference. Keep model/effort choices in `.codex/agents/dev_team_*.toml`, before `developer_instructions`; avoid duplicating editable values in the Markdown profile. Never silently change an unavailable model.
7. Present the profile for review, especially release commands and protected paths. Tell the user to open a fresh CLI/desktop session so newly installed agents are discovered before dev-team-run. Do not commit or publish.

For removal, `node "PACKAGE/scripts/install.mjs" --cwd "REPOSITORY" --uninstall` removes only unchanged owned agents; customized files and the profile remain. Plugin removal is a separate client action.
