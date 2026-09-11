import * as assert from "assert";
import * as vscode from "vscode";
import { collectDiagnostics } from "../evidence/diagnostics";
import { collectGitChanges } from "../evidence/git";
import { collectTerminalEvidence } from "../evidence/terminal";
import { collectFileContext } from "../evidence/context";
import { buildEvidencePacket } from "../evidence/packet";

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
  });

  test("should collect file context", () => {
    const filePath = __filename;

    const evidence = collectFileContext(filePath);

    assert.strictEqual(evidence.file, filePath);
    assert.ok(evidence.content.includes("should collect file context"));
  });

  test("should build an evidence packet", () => {
    const packet = buildEvidencePacket(process.cwd(), [__filename], "node", [
      "-e",
      'console.log("packet test")',
    ]);
    assert.ok(Array.isArray(packet.diagnostics));
    assert.ok(Array.isArray(packet.gitChanges));
    assert.strictEqual(packet.terminal?.exitCode, 0);
    assert.ok(Array.isArray(packet.fileContexts));
    assert.strictEqual(packet.fileContexts.length, 1);
  });
});
