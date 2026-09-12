<div align="center">
  <img src="https://raw.githubusercontent.com/Anjula2001/DoubtCatch/main/assets/Logo.png" alt="DoubtCatch" width="128" />

  # DoubtCatch

  **Catch the problem. Prove the fix.**
</div>

DoubtCatch captures concrete debugging evidence from a VS Code project and turns
it into an evidence-based prompt for AI coding agents.

It is **not** another coding agent. It is the evidence layer you reach for when
an agent has already tried to fix something and the problem is still there.

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

## V1 workflow

1. Open your project in VS Code.
2. Observe a problem.
3. Run **DoubtCatch: Capture Evidence** from the Command Palette.
4. Describe the symptom in your own words.
5. Optionally capture a terminal command (for example `npm test`), or skip it.
6. DoubtCatch collects editor diagnostics, Git changes, and relevant file context.
7. Run **DoubtCatch: Generate Agent Prompt**.
8. The prompt is copied to your clipboard.
9. Paste it into Claude Code, Cursor, GitHub Copilot, or any other coding agent.

Step 7 is also offered as a button on the notification that follows step 6.

## Commands

| Command | What it does |
| --- | --- |
| `DoubtCatch: Capture Evidence` | Asks for your symptom, optionally runs one command, and collects evidence into the DoubtCatch output channel. |
| `DoubtCatch: Generate Agent Prompt` | Turns the most recent capture into a prompt and copies it to the clipboard. |

If you run Generate Agent Prompt before capturing anything, DoubtCatch tells you
to capture evidence first rather than producing an empty prompt.

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
├── extension.ts              Command registration and all user prompts
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

## Known limitations

These are real limits of V1, not oversights:

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

## Future work

Not in V1, and not claimed anywhere in the extension:

- automatic verification that a fix actually worked
- automatic failure replay
- direct integration with specific agents, or MCP
- sending evidence to an AI API
- broader language support in relevant-file detection

## Development

```bash
npm install
npm run compile      # type-check, lint, bundle with esbuild
npm run lint
npm test             # runs in a real VS Code Extension Host
npm run watch        # rebuild on change
```

Press <kbd>F5</kbd> in VS Code to launch an Extension Development Host with
DoubtCatch loaded.

Tests run in a real Extension Host via `@vscode/test-cli`, so they need a
display. CI runs them on Linux under `xvfb-run`.

### Publishing

DoubtCatch is not on the Marketplace yet. Before the first `vsce publish`:

1. Create a publisher at https://marketplace.visualstudio.com/manage and add a
   `"publisher"` field to `package.json` matching that ID.
2. Choose a license, add a `LICENSE` file, and set the `"license"` field.
3. `npx @vscode/vsce package` to produce the `.vsix`, then `vsce publish`.
