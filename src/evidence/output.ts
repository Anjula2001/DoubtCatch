import { OutputChannel } from "vscode";
import { EvidencePacket } from "./packet";

export function writeEvidenceToOutput(
  output: OutputChannel,
  packet: EvidencePacket,
): void {
  output.clear();

  output.appendLine("=== DoubtCatch Evidence ===");
  output.appendLine("");

  output.appendLine("User Symptom:");
  output.appendLine(packet.userSymptom);

  output.appendLine("Diagnostics:");
  output.appendLine(JSON.stringify(packet.diagnostics, null, 2));

  output.appendLine("");
  output.appendLine("Git Changes:");
  output.appendLine(JSON.stringify(packet.gitChanges, null, 2));

  output.appendLine("");
  output.appendLine("File Contexts:");
  output.appendLine(JSON.stringify(packet.fileContexts, null, 2));

  output.show();
}