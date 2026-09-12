import * as assert from "assert";
import * as vscode from "vscode";
import { collectDiagnostics } from "../evidence/diagnostics";
import { collectGitChanges } from "../evidence/git";
import { collectTerminalEvidence } from "../evidence/terminal";
import { collectFileContext } from "../evidence/context";
import { buildEvidencePacket, EvidencePacket } from "../evidence/packet";
import { writeEvidenceToOutput } from "../evidence/output";
import { findRelevantFiles } from "../evidence/relevance";
import { redactSecrets, REDACTION_PLACEHOLDER } from "../evidence/redact";
import { hasShellOperator, parseCommandLine } from "../evidence/commandLine";
import { writeFileSync, mkdirSync, rmSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { buildAgentPrompt } from "../ai/prompt";

function createTempDirectory(): string {
  return mkdtempSync(join(tmpdir(), "doubtcatch-test-"));
}

/** Captures what the renderer writes, since OutputChannel cannot be read back. */
function createFakeOutputChannel(): {
  channel: vscode.OutputChannel;
  text(): string;
} {
  const lines: string[] = [];

  const channel = {
    name: "DoubtCatch Test",
    append: (value: string) => {
      lines.push(value);
    },
    appendLine: (value: string) => {
      lines.push(value);
    },
    replace: (value: string) => {
      lines.length = 0;
      lines.push(value);
    },
    clear: () => {
      lines.length = 0;
    },
    show: () => undefined,
    hide: () => undefined,
    dispose: () => undefined,
  } as unknown as vscode.OutputChannel;

  return { channel, text: () => lines.join("\n") };
}

suite("Evidence Test Suite", () => {
  test("should collect VS Code diagnostics", async () => {
    const testFile = vscode.Uri.file("/tmp/doubtcatch-test.ts");

    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 10),
      "Test error",
      vscode.DiagnosticSeverity.Error,
    );

    vscode.languages
      .createDiagnosticCollection("doubtcatch-test")
      .set(testFile, [diagnostic]);

    const evidence = collectDiagnostics();

    const found = evidence.find((item) => item.message === "Test error");

    assert.ok(found);
    assert.strictEqual(found?.line, 1);
    assert.strictEqual(found?.severity, "error");
  });

  test("should collect Git changed files", () => {
    const workspacePath = process.cwd();
    const changes = collectGitChanges(workspacePath);

    assert.ok(Array.isArray(changes));
  });

  test("should return no Git changes outside a repository", () => {
    const directory = createTempDirectory();

    try {
      assert.deepStrictEqual(collectGitChanges(directory), []);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("should collect terminal evidence", async () => {
    const evidence = await collectTerminalEvidence("node", [
      "-e",
      'console.log("test")',
    ]);

    assert.strictEqual(evidence.exitCode, 0);
    assert.strictEqual(evidence.output.trim(), "test");
  });

  test("should capture failed terminal command", async () => {
    const evidence = await collectTerminalEvidence("node", [
      "-e",
      'console.error("test error"); process.exit(1)',
    ]);

    assert.strictEqual(evidence.exitCode, 1);
    assert.ok(evidence.output.includes("test error"));
    assert.strictEqual(
      evidence.command,
      'node -e console.error("test error"); process.exit(1)',
    );
  });

  test("should report a command that cannot be run", async () => {
    const evidence = await collectTerminalEvidence(
      "doubtcatch-no-such-command",
    );

    assert.notStrictEqual(evidence.exitCode, 0);
    assert.ok(evidence.output.includes("could not be run"));
  });

  test("should collect file context", () => {
    const filePath = __filename;

    const evidence = collectFileContext(filePath);

    assert.strictEqual(evidence.file, filePath);
    assert.ok(evidence.content.includes("should collect file context"));
  });

  test("should not throw when a file cannot be read", () => {
    const directory = createTempDirectory();

    try {
      const evidence = collectFileContext(directory);

      assert.ok(evidence.content.includes("could not read"));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("should build an evidence packet", async () => {
    const packet = await buildEvidencePacket(
      process.cwd(),
      [__filename],
      "",
      "node",
      ["-e", 'console.log("packet test")'],
    );

    assert.ok(Array.isArray(packet.diagnostics));
    assert.ok(Array.isArray(packet.gitChanges));
    assert.strictEqual(packet.terminal?.exitCode, 0);
    assert.ok(Array.isArray(packet.fileContexts));
    assert.ok(packet.fileContexts.length >= 1);
    assert.ok(packet.fileContexts.some((file) => file.file === __filename));
    assert.strictEqual(packet.workspacePath, process.cwd());
  });

  test("should leave terminal evidence undefined when capture is skipped", async () => {
    const packet = await buildEvidencePacket(process.cwd(), [__filename]);

    assert.strictEqual(packet.terminal, undefined);
  });

  test("should keep the reason a file was considered relevant", async () => {
    const packet = await buildEvidencePacket(process.cwd(), [__filename]);

    const active = packet.fileContexts.find(
      (file) => file.file === __filename,
    );

    assert.strictEqual(active?.reason, "Active file");
  });

  test("should write evidence to output channel", () => {
    const output = createFakeOutputChannel();

    const packet: EvidencePacket = {
      workspacePath: "/workspace",
      userSymptom: "Save button does nothing",
      diagnostics: [],
      gitChanges: [],
      fileContexts: [],
    };

    writeEvidenceToOutput(output.channel, packet);

    const text = output.text();

    assert.ok(text.includes("=== DoubtCatch Evidence ==="));
    assert.ok(text.includes("Save button does nothing"));
    assert.ok(text.includes("Diagnostics: None"));
    assert.ok(text.includes("Git Changes: None"));
    assert.ok(text.includes("Relevant Files: None"));
    assert.ok(text.includes("Not captured"));
  });

  test("should write terminal evidence to output channel when present", () => {
    const output = createFakeOutputChannel();

    const packet: EvidencePacket = {
      workspacePath: "/workspace",
      userSymptom: "Tests fail",
      diagnostics: [
        {
          file: "src/app.ts",
          line: 10,
          severity: "error",
          message: "Something went wrong",
        },
      ],
      terminal: { command: "npm test", output: "1 failing", exitCode: 1 },
      gitChanges: ["src/app.ts (modified)"],
      fileContexts: [
        { file: "src/app.ts", reason: "Active file", content: "const a = 1;" },
      ],
    };

    writeEvidenceToOutput(output.channel, packet);

    const text = output.text();

    assert.ok(text.includes("Diagnostics: 1"));
    assert.ok(text.includes("[error] src/app.ts:10 Something went wrong"));
    assert.ok(text.includes("Command:   npm test"));
    assert.ok(text.includes("Exit code: 1"));
    assert.ok(text.includes("1 failing"));
    assert.ok(text.includes("src/app.ts (modified)"));
    assert.ok(text.includes("Active file"));
  });

  test("should find imported files as relevant", () => {
    const workspacePath = process.cwd();

    const files = findRelevantFiles(workspacePath, __filename);

    assert.ok(files.some((file) => file.file === __filename));
  });

  test("should find relative imported files", () => {
    const testDirectory = createTempDirectory();

    const activeFile = join(testDirectory, "test-active.ts");
    const helperFile = join(testDirectory, "test-helper.ts");

    writeFileSync(
      activeFile,
      'import { helper } from "./test-helper";\n\nconsole.log(helper);',
    );

    writeFileSync(helperFile, "export const helper = true;");

    const files = findRelevantFiles(testDirectory, activeFile);

    assert.ok(files.some((file) => file.file === activeFile));
    assert.ok(files.some((file) => file.file === helperFile));
    assert.ok(
      files.some(
        (file) =>
          file.file === helperFile && file.reason.includes("Imported by"),
      ),
    );

    rmSync(testDirectory, { recursive: true, force: true });
  });

  test("should not resolve a directory as an imported file", () => {
    const testDirectory = createTempDirectory();

    const activeFile = join(testDirectory, "active.ts");
    const moduleDirectory = join(testDirectory, "my.module");

    mkdirSync(moduleDirectory, { recursive: true });

    writeFileSync(activeFile, 'import x from "./my.module";\n');

    const files = findRelevantFiles(testDirectory, activeFile);

    assert.ok(!files.some((file) => file.file === moduleDirectory));

    rmSync(testDirectory, { recursive: true, force: true });
  });

  test("should resolve an index file inside an imported directory", () => {
    const testDirectory = createTempDirectory();

    const activeFile = join(testDirectory, "active.ts");
    const moduleDirectory = join(testDirectory, "widgets");
    const indexFile = join(moduleDirectory, "index.ts");

    mkdirSync(moduleDirectory, { recursive: true });

    writeFileSync(activeFile, 'import x from "./widgets";\n');
    writeFileSync(indexFile, "export default 1;");

    const files = findRelevantFiles(testDirectory, activeFile);

    assert.ok(files.some((file) => file.file === indexFile));

    rmSync(testDirectory, { recursive: true, force: true });
  });

  test("should build an AI agent prompt from evidence", () => {
    const packet: EvidencePacket = {
      workspacePath: "/workspace",
      userSymptom: "The save button does not save the member.",
      diagnostics: [
        {
          file: "src/app.ts",
          line: 10,
          severity: "error",
          message: "Something went wrong",
        },
      ],
      gitChanges: ["src/app.ts (modified)"],
      terminal: {
        command: "npm test",
        output: "test failed",
        exitCode: 1,
      },
      fileContexts: [
        {
          file: "src/app.ts",
          reason: "Active file",
          content: "console.log('hello');",
        },
      ],
    };

    const prompt = buildAgentPrompt(packet);

    assert.ok(prompt.includes("The save button does not save the member."));
    assert.ok(prompt.includes("Something went wrong"));
    assert.ok(prompt.includes("src/app.ts"));
    assert.ok(prompt.includes("test failed"));
    assert.ok(prompt.includes("console.log('hello');"));
    assert.ok(prompt.includes("most likely root cause"));
    assert.ok(prompt.includes("smallest appropriate fix"));
    assert.ok(
      prompt.includes(
        "Do not assume the issue is fixed merely because the code looks correct.",
      ),
    );
  });

  test("should mark missing evidence in the agent prompt", () => {
    const packet: EvidencePacket = {
      workspacePath: "/workspace",
      userSymptom: "Something is wrong",
      diagnostics: [],
      gitChanges: [],
      fileContexts: [],
    };

    const prompt = buildAgentPrompt(packet);

    assert.ok(prompt.includes("None reported."));
    assert.ok(prompt.includes("Not captured."));
  });
});

suite("Redaction Test Suite", () => {
  test("should redact a quoted secret assignment", () => {
    const source =
      '    private static final String SECRET = "super-secret-value";';

    const redacted = redactSecrets(source);

    assert.ok(!redacted.includes("super-secret-value"));
    assert.ok(redacted.includes(REDACTION_PLACEHOLDER));
    assert.ok(redacted.includes("private static final String SECRET"));
  });

  test("should redact environment style assignments", () => {
    const source = "DB_PASSWORD=hunter2\nexport API_KEY=abc123xyz\nPORT=3000";

    const redacted = redactSecrets(source);

    assert.ok(!redacted.includes("hunter2"));
    assert.ok(!redacted.includes("abc123xyz"));
    assert.ok(redacted.includes("PORT=3000"));
  });

  test("should redact JWT-like tokens", () => {
    const token =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk";

    const redacted = redactSecrets(`const t = "${token}";`);

    assert.ok(!redacted.includes(token));
    assert.ok(redacted.includes(REDACTION_PLACEHOLDER));
  });

  test("should redact credentials in a connection string", () => {
    const redacted = redactSecrets(
      "postgres://appuser:s3cretpw@db.internal:5432/app",
    );

    assert.ok(!redacted.includes("s3cretpw"));
    assert.ok(redacted.includes("appuser"));
    assert.ok(redacted.includes("db.internal:5432/app"));
  });

  test("should redact private key blocks", () => {
    const redacted = redactSecrets(
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----",
    );

    assert.ok(!redacted.includes("MIIEpAIBAAKCAQEA"));
    assert.strictEqual(redacted.trim(), REDACTION_PLACEHOLDER);
  });

  test("should redact provider token shapes and bearer headers", () => {
    const redacted = redactSecrets(
      "gh: ghp_AAAABBBBCCCCDDDDEEEE1234\nheader: Bearer abcdefghijklmnop1234567890\naws: AKIAIOSFODNN7EXAMPLE",
    );

    assert.ok(!redacted.includes("ghp_AAAABBBBCCCCDDDDEEEE1234"));
    assert.ok(!redacted.includes("abcdefghijklmnop1234567890"));
    assert.ok(!redacted.includes("AKIAIOSFODNN7EXAMPLE"));
    assert.ok(redacted.includes("Bearer " + REDACTION_PLACEHOLDER));
  });

  test("should leave ordinary source code unchanged", () => {
    const source = [
      "function saveMember(member) {",
      "  if (password.length === 0) {",
      "    return;",
      "  }",
      '  const passwordField = document.getElementById("password");',
      "  let token = getToken();",
      '  const empty = "";',
      "  return db.save(member);",
      "}",
      "We use Basic authentication for the admin panel.",
    ].join("\n");

    assert.strictEqual(redactSecrets(source), source);
  });

  test("should be safe to apply more than once", () => {
    const source = 'const apiKey = "sk-ant-aaaabbbbccccddddeeeeffff";';

    const once = redactSecrets(source);

    assert.strictEqual(redactSecrets(once), once);
  });

  test("should redact secrets before they reach a file context", () => {
    const directory = createTempDirectory();
    const filePath = join(directory, "config.ts");

    try {
      writeFileSync(filePath, 'export const apiKey = "totally-real-key-123";');

      const context = collectFileContext(filePath, "Active file");

      assert.ok(!context.content.includes("totally-real-key-123"));
      assert.ok(context.content.includes(REDACTION_PLACEHOLDER));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("should redact secrets before they reach the agent prompt", () => {
    const packet: EvidencePacket = {
      workspacePath: "/workspace",
      userSymptom: "Login fails",
      diagnostics: [],
      gitChanges: [],
      fileContexts: [
        {
          file: "src/config.ts",
          reason: "Active file",
          content: 'const password = "letmein-please";',
        },
      ],
    };

    const prompt = buildAgentPrompt(packet);

    assert.ok(!prompt.includes("letmein-please"));
    assert.ok(prompt.includes(REDACTION_PLACEHOLDER));
  });
});

suite("Command Line Test Suite", () => {
  test("should split a command into a command and arguments", () => {
    assert.deepStrictEqual(parseCommandLine("npm test"), ["npm", "test"]);
    assert.deepStrictEqual(parseCommandLine("  npm   run   lint  "), [
      "npm",
      "run",
      "lint",
    ]);
  });

  test("should keep quoted arguments together", () => {
    assert.deepStrictEqual(parseCommandLine('npm run "my task"'), [
      "npm",
      "run",
      "my task",
    ]);
    assert.deepStrictEqual(parseCommandLine("node -e 'console.log(1)'"), [
      "node",
      "-e",
      "console.log(1)",
    ]);
  });

  test("should return nothing for empty input", () => {
    assert.deepStrictEqual(parseCommandLine("   "), []);
  });

  test("should detect shell operators", () => {
    assert.ok(hasShellOperator(parseCommandLine("npm test && npm run lint")));
    assert.ok(!hasShellOperator(parseCommandLine("npm test")));
  });
});
