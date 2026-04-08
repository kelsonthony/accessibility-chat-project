# Repository Guidelines

## Project Structure & Module Organization

This repository is currently lightweight and planning-focused.

- `CODEX.md`: product and architecture brief for the accessibility RAG platform.
- `open-oracle-tunnels.sh`: utility script for opening local SSH tunnels to Oracle Cloud services.
- `infra/`: expected location for infrastructure assets referenced by scripts, such as SSH keys.

When application code is added, keep feature code under `src/`, tests under `tests/` or alongside modules as `*.test.*`, and static assets under `assets/`.

## Build, Test, and Development Commands

There is no application build pipeline yet. Current useful commands are:

- `bash open-oracle-tunnels.sh start`: open the local Oracle Cloud tunnels.
- `bash open-oracle-tunnels.sh status`: check tunnel status and forwarded ports.
- `bash open-oracle-tunnels.sh stop`: close active tunnels.
- `bash -n open-oracle-tunnels.sh`: validate shell syntax before committing script changes.

If a Node or backend app is introduced later, document its local run and test commands in this file and in the root README.

## Coding Style & Naming Conventions

Use ASCII by default. For shell scripts:

- Indent with 2 spaces or keep logic flush-left when idiomatic Bash makes that clearer.
- Prefer uppercase environment variables such as `REMOTE_HOST` and `LOCAL_API_PORT`.
- Use `set -euo pipefail` for new scripts.
- Name executable scripts with kebab-case, for example `sync-accessibility-sources.sh`.

Keep Markdown short, task-oriented, and specific to this repository.

## Testing Guidelines

No automated test suite is configured yet. Until one exists:

- Run `bash -n` on every edited shell script.
- Manually verify `start`, `status`, and `stop` flows when changing tunnel logic.
- Add tests with the code you introduce; prefer `*.test.sh` for shell helpers or the default test framework of the added runtime.

## Commit & Pull Request Guidelines

Git history is not available in this workspace snapshot, so no repository-specific commit pattern can be inferred. Use short imperative commit subjects, such as `Add Oracle tunnel status validation`.

Pull requests should include:

- a brief summary of the change,
- any operational impact on ports, hosts, or credentials,
- verification steps run locally,
- screenshots only when UI work is added.

## Security & Configuration Tips

Do not commit private keys, secrets, or filled `.env` files. Keep machine-specific paths configurable through environment variables, and prefer documented defaults over hardcoded credentials.
