// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { buildEvidencePacket, EvidencePacket } from "./evidence/packet";
import { writeEvidenceToOutput } from "./evidence/output";
import { buildAgentPrompt } from "./ai/prompt";
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
let lastEvidencePacket: EvidencePacket | undefined;
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "doubtcatch" is now active!');
	const output = vscode.window.createOutputChannel('DoubtCatch');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "doubtcatch.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from DoubtCatch!");
    },
  );

  const captureEvidence = vscode.commands.registerCommand(
    "doubtcatch.captureEvidence",
    async () => {
      const workspace = vscode.workspace.workspaceFolders?.[0];

      if (!workspace) {
        vscode.window.showWarningMessage("DoubtCatch: No workspace is open.");
        return;
      }

      const userSymptom = await vscode.window.showInputBox({
  prompt: "What problem are you seeing?",
  placeHolder: "Example: The save button does not save the member",
});

if (userSymptom === undefined) {
  return;
}

const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
const filePaths = activeFile ? [activeFile] : [];

const packet = buildEvidencePacket(
  workspace.uri.fsPath,
  filePaths,
  userSymptom,
);
lastEvidencePacket = packet;

      writeEvidenceToOutput(output, packet);
    },
  );

	const generateAgentPrompt = vscode.commands.registerCommand(
  "doubtcatch.generateAgentPrompt",
  async () => {
    const workspace = vscode.workspace.workspaceFolders?.[0];

    if (!workspace) {
      vscode.window.showWarningMessage("DoubtCatch: No workspace is open.");
      return;
    }

    const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
    const filePaths = activeFile ? [activeFile] : [];

    if (!lastEvidencePacket) {
  vscode.window.showWarningMessage(
    "DoubtCatch: Capture evidence first.",
  );
  return;
}

const prompt = buildAgentPrompt(lastEvidencePacket);

    await vscode.env.clipboard.writeText(prompt);

    vscode.window.showInformationMessage(
      "DoubtCatch: Agent prompt copied to clipboard.",
    );
  },
);

  context.subscriptions.push(captureEvidence);

  context.subscriptions.push(disposable);

	context.subscriptions.push(generateAgentPrompt);
}

// This method is called when your extension is deactivated
export function deactivate() {}
