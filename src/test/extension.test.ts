
import * as assert from "assert";
import * as vscode from "vscode";
import { collectDiagnostics } from "../evidence/diagnostics";
import { collectGitChanges } from "../evidence/git";
import { collectTerminalEvidence } from "../evidence/terminal";
import { collectFileContext } from "../evidence/context";
import { buildEvidencePacket } from "../evidence/packet";
import { writeEvidenceToOutput } from "../evidence/output";
import { findRelevantFiles } from "../evidence/relevance";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { buildAgentPrompt } from "../ai/prompt";

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

  test("should collect terminal evidence", () => {
    const evidence = collectTerminalEvidence("node", [
      "-e",
      'console.log("test")',
    ]);

    assert.strictEqual(evidence.exitCode, 0);
    assert.strictEqual(evidence.output.trim(), "test");
  });

  test("should capture failed terminal command", () => {
    const evidence = collectTerminalEvidence("node", [
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

  test("should collect file context", () => {
    const filePath = __filename;

    const evidence = collectFileContext(filePath);

    assert.strictEqual(evidence.file, filePath);
    assert.ok(evidence.content.includes("should collect file context"));
  });

  test("should build an evidence packet", () => {
    const packet = buildEvidencePacket(
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
    assert.ok(
      packet.fileContexts.some((file) => file.file === __filename),
    );
  });

  test("should write evidence to output channel", () => {
    const output = vscode.window.createOutputChannel("DoubtCatch Test");

    const packet = buildEvidencePacket(process.cwd(), [__filename]);

    writeEvidenceToOutput(output, packet);

    output.dispose();
  });

  test("should find imported files as relevant", () => {
    const workspacePath = process.cwd();

    const files = findRelevantFiles(workspacePath, __filename);

    assert.ok(files.some((file) => file.file === __filename));
  });

  test("should find relative imported files", () => {
    const testDirectory = join(process.cwd(), "temp-relevance-test");

    mkdirSync(testDirectory, { recursive: true });

    const activeFile = join(testDirectory, "test-active.ts");
    const helperFile = join(testDirectory, "test-helper.ts");

    writeFileSync(
      activeFile,
      'import { helper } from "./test-helper";\n\nconsole.log(helper);',
    );

    writeFileSync(helperFile, "export const helper = true;");

    const files = findRelevantFiles(process.cwd(), activeFile);

    assert.ok(files.some((file) => file.file === activeFile));
    assert.ok(files.some((file) => file.file === helperFile));
    assert.ok(
      files.some(
        (file) =>
          file.file === helperFile &&
          file.reason.includes("Imported by"),
      ),
    );

    rmSync(testDirectory, { recursive: true, force: true });
  });

  test("should build an AI agent prompt from evidence", () => {
    const packet = {
      userSymptom: "The save button does not save the member.",
      diagnostics: [
        {
          file: "src/app.ts",
          line: 10,
          severity: "error",
          message: "Something went wrong",
        },
      ],
      gitChanges: ["src/app.ts"],
      terminal: {
        command: "npm test",
        output: "test failed",
        exitCode: 1,
      },
      fileContexts: [
        {
          file: "src/app.ts",
          content: "console.log('hello');",
        },
      ],
    };

    const prompt = buildAgentPrompt(packet);

    assert.ok(
      prompt.includes("The save button does not save the member."),
    );
    assert.ok(prompt.includes("Something went wrong"));
    assert.ok(prompt.includes("src/app.ts"));
    assert.ok(prompt.includes("test failed"));
    assert.ok(prompt.includes("console.log('hello');"));
    assert.ok(prompt.includes("most likely root cause"));
  });
});
