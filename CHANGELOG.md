# Change Log

All notable changes to the DoubtCatch extension are documented in this file.

This project follows [Keep a Changelog](https://keepachangelog.com/) and
[Semantic Versioning](https://semver.org/).

## [0.1.0] — V1

First usable release: capture evidence, generate a prompt, paste it into any
AI coding agent.

### Added

- **Secret redaction.** Evidence is redacted where it is collected, so obvious
  credentials never reach the output channel or the generated prompt. Covers
  secret-looking assignments, environment-style assignments, JWTs, private key
  blocks, connection-string credentials, `Authorization` headers and common
  provider token shapes. Heuristic, not a guarantee.
- **Opt-in terminal capture in the capture flow.** After describing the symptom
  you can choose to run one command; its output and exit code join the evidence.
  Commands run through `execFile` with no shell and a 60 second timeout.
- **Readable output channel.** Ordered sections with explicit `None` and
  `Not captured` states instead of raw JSON dumps.
- **Rewritten agent prompt.** Sectioned evidence plus explicit instructions to
  reason from the evidence, avoid unrelated changes, propose the smallest fix,
  and not to assume the issue is fixed because the code looks correct.
- Marketplace metadata: icon, repository, categories and keywords.

### Fixed

- Capture no longer fails in a workspace that is not a Git repository.
- Git changes now include staged and untracked files, with a status label, not
  just unstaged modifications.
- A directory whose name contains a dot is no longer resolved as an imported
  file, which previously aborted capture with `EISDIR`.
- The reason a file was considered relevant now reaches the packet, the output
  channel and the prompt instead of being discarded.
- Unreadable files and failed commands are reported as evidence instead of
  throwing.
- Import resolution now also handles `.mjs`, `.cjs`, `.mts`, `.cts` and index
  files in an imported directory.
- File contents, command output, diagnostics and change lists are capped so the
  generated prompt stays a usable size.

### Changed

- `buildEvidencePacket` and `collectTerminalEvidence` are now asynchronous, so
  running a command no longer blocks the VS Code UI.
- `EvidencePacket` gained `workspacePath`, and `FileContext` gained `reason`.

### Removed

- The `doubtcatch.helloWorld` scaffolding command.
