<div align="center">
  <img src="https://raw.githubusercontent.com/Anjula2001/DoubtCatch/main/assets/Logo.png" alt="DoubtCatch" width="128" />

  # DoubtCatch

  **Catch the problem. Prove the fix.**
</div>

DoubtCatch is an agent-agnostic VS Code extension for diagnosing and verifying
AI-assisted coding issues. It captures concrete debugging evidence from a VS
Code project and turns it into an evidence-based prompt for an AI coding agent.

It is **not** an AI coding agent. It is the evidence layer you reach for when
an agent has already tried to fix something and the problem is still there, or
when you need stronger evidence before deciding what to do next.

---

## Why

```
You hit a problem
      ↓
Your AI agent attempts a fix
      ↓
The problem is still there, or you are not sure
      ↓
DoubtCatch captures what is actually happening
      ↓
DoubtCatch generates a structured debugging prompt
      ↓
You paste it into your agent
```

Agents fail most often when they reason from what the code *looks* like instead
of from what the program *does*. DoubtCatch gives them the second thing:
diagnostics, real command output, real exit codes, and the actual working-tree
state.

## How it works

```
Describe the problem
  ↓
Capture Evidence
  ↓
Diagnostics + Git + Terminal + Relevant Files
  ↓
EvidencePacket
  ↓
Generate AI Prompt
  ↓
Use the prompt with your AI coding agent
```

You describe the behavior you are seeing. DoubtCatch collects the editor
diagnostics, working-tree changes, optional command output, and relevant local
file context into one `EvidencePacket`. It then renders that packet into a
structured prompt and copies it to the clipboard for use with the AI coding
agent of your choice.

## VS Code integration

DoubtCatch provides a dedicated Activity Bar icon and native sidebar:

```
Activity Bar
    ↓
DoubtCatch
    ↓
Capture Evidence
Generate AI Prompt
```

The sidebar is the primary entry point, so you do not need to open the Command
Palette for the normal V1 workflow. The original Command Palette commands remain
available for keyboard and power users.

<!-- TODO: Add a screenshot of the DoubtCatch Activity Bar icon and sidebar. -->

## V1 workflow

1. Open your project in VS Code.
2. Click the DoubtCatch icon in the Activity Bar.
3. Click **Capture Evidence**.
4. Describe the problem when prompted.
5. Review the captured evidence in the DoubtCatch output channel.
6. Click **Generate AI Prompt**.
7. Paste the generated prompt into your AI coding agent.

The same actions are also available through the VS Code Command Palette as
**DoubtCatch: Capture Evidence** and **DoubtCatch: Generate Agent Prompt**.

## Commands

| Command | What it does |
| --- | --- |
| `DoubtCatch: Capture Evidence` | Asks for your symptom, optionally runs one command, and collects evidence into the DoubtCatch output channel. |
| `DoubtCatch: Generate Agent Prompt` | Turns the most recent capture into a prompt and copies it to the clipboard. |

If you run Generate Agent Prompt before capturing anything, DoubtCatch tells you
to capture evidence first rather than producing an empty prompt.

## Features

- Native VS Code Activity Bar integration
- DoubtCatch sidebar with the two primary V1 actions
- Evidence capture from the active VS Code workspace
- VS Code editor diagnostics
- Staged, unstaged, and untracked Git changes
- Optional terminal evidence with command output and exit code
- Relevant active-file and direct local-import context
- Secret redaction before evidence reaches the output or prompt
- Structured `EvidencePacket` shared by the output renderer and prompt builder
- Evidence-based AI prompt generation
- Clipboard support for the generated prompt
- Safe command execution without a shell
- File and terminal-context size limits

## What gets collected

| Evidence | Source | When absent |
| --- | --- | --- |
| User symptom | What you typed | `(not described)` |
| Diagnostics | `vscode.languages.getDiagnostics()` | `None` |
| Terminal evidence | A command you explicitly chose to run | `Not captured` |
| Git changes | `git status --porcelain` (staged, unstaged and untracked) | `None` |
| Relevant files | The active file plus the local files it imports | `None` |

## Privacy and security

- **Nothing is sent anywhere.** V1 makes no network calls and talks to no AI API.
  Prompt generation happens entirely on your machine.
- **The clipboard is the only output.** Evidence leaves DoubtCatch only when you
  run Generate Agent Prompt, and only into your own clipboard. Where it goes next
  is your choice.
- **No command runs without you asking.** Terminal capture is opt-in per capture,
  you type the command yourself, and it is executed with `execFile` and no shell,
  so nothing in the command line can be interpreted as a second command.
  Commands are bounded by a 60 second timeout.
- **Secrets are redacted before they reach the prompt.** See below.

Evidence can still contain your source code. Read the output channel before you
paste a prompt into a third-party agent.

### Secret redaction

Evidence is redacted at the point it is collected, so obvious credentials do not
reach the output channel or the generated prompt. DoubtCatch currently detects:

- quoted assignments to secret-looking keys (`password`, `secret`, `token`,
  `api_key`, `client_secret`, `private_key`, and similar)
- `UPPER_SNAKE` environment-style assignments such as `DB_PASSWORD=...`
- JWT-like tokens
- PEM and OpenSSH private key blocks
- credentials embedded in connection URIs (`postgres://user:pass@host`)
- `Authorization: Bearer` / `Basic` header values
- recognisable provider token shapes (GitHub, AWS, Slack, Stripe, Google, npm,
  and `sk-` style API keys)

Redacted values are replaced with `[REDACTED_SECRET]`, keeping the surrounding
code structure intact so an agent can still read the file.

> **This is heuristic protection, not a guarantee.** It will miss secrets that
> do not match these patterns, and it may redact a value that was never secret.
> Review the evidence before sharing it.

## Architecture

```
src/
├── extension.ts              Command registration and user prompts
├── sidebar.ts                Activity Bar webview sidebar provider
├── evidence/
│   ├── packet.ts             Builds the EvidencePacket — the central object
│   ├── diagnostics.ts        Editor diagnostics
│   ├── git.ts                Working-tree changes
│   ├── terminal.ts           Opt-in command execution (execFile, no shell)
│   ├── relevance.ts          Active file + its direct local imports
│   ├── context.ts            File reading, redaction and truncation
│   ├── redact.ts             Heuristic secret redaction
│   ├── commandLine.ts        Quote-aware command line parsing
│   ├── truncate.ts           Size limits
│   ├── paths.ts              Workspace-relative display paths
│   └── output.ts             Human-readable output channel rendering
└── ai/prompt.ts              Agent prompt generation
```

Every collector feeds one structured `EvidencePacket`:

```
EvidencePacket
├── workspacePath
├── userSymptom
├── diagnostics
├── terminal      (optional)
├── gitChanges
└── fileContexts
```

The packet is the only thing the output renderer and the prompt builder read, so
adding a new evidence source means adding one collector and one field.

The Activity Bar container and sidebar are declared in `package.json`. The
sidebar provider sends button actions to the existing extension commands; it
does not access the filesystem or run terminal commands directly.

## Current limitations

These are real limits of V1, not oversights:

- **No automatic browser capture.** V1 does not automatically capture the
  Browser DevTools Console, Browser Network tab, or localhost browser runtime
  errors. Browser and replay integration are planned future areas.
- **Relevant-file detection is deliberately shallow.** It reads the active file
  and resolves its *direct* relative imports (`./`, `../`) for JavaScript and
  TypeScript only. It is not a dependency graph. Bare package imports, path
  aliases, and other languages are not followed. At most 8 files are included.
- **Secret redaction is heuristic** (see above).
- **One command per capture.** Because no shell is used, operators like `&&`
  are passed through as plain arguments. DoubtCatch warns you when it sees one.
- **On Windows, shell-script commands need their real executable name.** `npm`
  resolves to `npm.cmd`, which `execFile` without a shell will not find; use the
  underlying binary or a `.cmd` name explicitly.
- **Only the first workspace folder** is used in a multi-root workspace.
- Large files are truncated to 8,000 characters and command output to the last
  8,000 characters, so the prompt stays usable.

## Roadmap

### V1 — Evidence Capture

- Diagnostics
- Git changes
- Terminal evidence
- Relevant file context
- Secret redaction
- Evidence-based prompt generation
- Native VS Code sidebar

### V2 — Agent Integration

- Direct AI-agent or tool integration

### V3 — Failure Verification

- Reproduce the original failure
- Verify the fix
- Feed verification evidence back to the agent

## Requirements and development

- VS Code `1.137.0` or newer
- Node.js and npm

Install dependencies and run the checks:

```bash
npm install
npm run compile      # type-check, lint, bundle with esbuild
npm run lint
npm test             # runs in a real VS Code Extension Host
npm run watch        # rebuild on change
```

Press <kbd>F5</kbd> in VS Code to launch an Extension Development Host with
DoubtCatch loaded. The Activity Bar contribution is read when that host starts,
so restart the Extension Development Host after changing the manifest.

Tests run in a real Extension Host via `@vscode/test-cli`, so they need a
display. CI runs them on Linux under `xvfb-run`.

### Packaging and publishing

Create and inspect a production VSIX with:

```bash
npx vsce package
npx vsce ls
```

The current publisher is `doubt-catch`. Upload the generated `.vsix` manually
through [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage).
Publishing is intentionally not automated from this repository.
