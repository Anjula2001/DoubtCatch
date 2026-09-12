import { OutputChannel } from "vscode";
import { EvidencePacket } from "./packet";
import { toDisplayPath } from "./paths";

/**
 * Renders the packet as a readable summary for the developer.
 *
 * File contents are summarised rather than dumped here; the full text goes into
 * the generated agent prompt.
 */
export function writeEvidenceToOutput(
  output: OutputChannel,
  packet: EvidencePacket,
): void {
  const lines: string[] = [];

  lines.push("=== DoubtCatch Evidence ===");
  lines.push(`Captured: ${new Date().toLocaleString()}`);
  lines.push(`Workspace: ${packet.workspacePath}`);
  lines.push("");

  lines.push("User Symptom:");
  lines.push(packet.userSymptom.trim() || "(not described)");
  lines.push("");

  lines.push(`Diagnostics: ${packet.diagnostics.length || "None"}`);
  for (const diagnostic of packet.diagnostics) {
    lines.push(
      `  [${diagnostic.severity}] ${diagnostic.file}:${diagnostic.line} ${diagnostic.message}`,
    );
  }
  lines.push("");

  lines.push("Terminal Evidence:");
  if (packet.terminal) {
    lines.push(`  Command:   ${packet.terminal.command}`);
    lines.push(
      `  Exit code: ${packet.terminal.exitCode}${packet.terminal.timedOut ? " (timed out)" : ""}`,
    );
    lines.push("  Output:");
    const terminalOutput = packet.terminal.output.trimEnd();
    if (terminalOutput) {
      for (const line of terminalOutput.split("\n")) {
        lines.push(`    ${line}`);
      }
    } else {
      lines.push("    (no output)");
    }
  } else {
    lines.push("  Not captured");
  }
  lines.push("");

  lines.push(`Git Changes: ${packet.gitChanges.length || "None"}`);
  for (const change of packet.gitChanges) {
    lines.push(`  ${change}`);
  }
  lines.push("");

  lines.push(`Relevant Files: ${packet.fileContexts.length || "None"}`);
  for (const file of packet.fileContexts) {
    const lineCount = file.content.split("\n").length;
    const reason = file.reason ? ` — ${file.reason}` : "";
    lines.push(
      `  ${toDisplayPath(packet.workspacePath, file.file)} (${lineCount} lines)${reason}`,
    );
  }

  output.clear();
  output.appendLine(lines.join("\n"));
  output.show(true);
}
