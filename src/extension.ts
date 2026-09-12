import * as vscode from "vscode";
import { buildEvidencePacket, EvidencePacket } from "./evidence/packet";
import { writeEvidenceToOutput } from "./evidence/output";
import { hasShellOperator, parseCommandLine } from "./evidence/commandLine";
import { buildAgentPrompt } from "./ai/prompt";

/** The most recent capture, reused by the Generate Agent Prompt command. */
let lastEvidencePacket: EvidencePacket | undefined;

/**
 * Asks whether the user wants to run a command as part of this capture, and if
 * so which one. Returns undefined when the user skips or cancels; nothing is
 * ever executed without an explicit choice here.
 */
async function askForTerminalCommand(): Promise<string[] | undefined> {
  const choice = await vscode.window.showQuickPick(
    [
      {
        label: "Skip",
        description: "Capture evidence without running anything",
      },
      {
        label: "Run a command",
        description: "For example: npm test",
      },
    ],
    {
      title: "DoubtCatch: Capture a terminal command?",
      placeHolder: "Running a command records its output and exit code",
    },
  );

  if (!choice || choice.label === "Skip") {
    return undefined;
  }

  const input = await vscode.window.showInputBox({
    title: "DoubtCatch: Command to run",
    prompt: "Run in the workspace root. No shell is used.",
    placeHolder: "npm test",
  });

  if (!input?.trim()) {
    return undefined;
  }

  const tokens = parseCommandLine(input);

  if (tokens.length === 0) {
    return undefined;
  }

  if (hasShellOperator(tokens)) {
    vscode.window.showWarningMessage(
      "DoubtCatch runs a single command without a shell, so operators like && are passed through as plain arguments.",
    );
  }

  return tokens;
}

async function captureEvidence(output: vscode.OutputChannel): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];

  if (!workspace) {
    vscode.window.showWarningMessage(
      "DoubtCatch: Open a folder or workspace before capturing evidence.",
    );
    return;
  }

  const userSymptom = await vscode.window.showInputBox({
    title: "DoubtCatch: Capture Evidence",
    prompt: "What problem are you seeing?",
    placeHolder: "Example: The save button does not save the member",
  });

  if (userSymptom === undefined) {
    return;
  }

  const tokens = await askForTerminalCommand();
  const [command, ...args] = tokens ?? [];

  const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
  const filePaths = activeFile ? [activeFile] : [];

  const packet = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: command
        ? `DoubtCatch: Capturing evidence (running ${command})...`
        : "DoubtCatch: Capturing evidence...",
    },
    () =>
      buildEvidencePacket(
        workspace.uri.fsPath,
        filePaths,
        userSymptom,
        command,
        args,
      ),
  );

  lastEvidencePacket = packet;

  writeEvidenceToOutput(output, packet);

  const summary = [
    `${packet.diagnostics.length} diagnostic(s)`,
    `${packet.gitChanges.length} changed file(s)`,
    `${packet.fileContexts.length} relevant file(s)`,
  ].join(", ");

  const generate = "Generate Agent Prompt";

  const action = await vscode.window.showInformationMessage(
    `DoubtCatch: Evidence captured — ${summary}.`,
    generate,
  );

  if (action === generate) {
    await vscode.commands.executeCommand("doubtcatch.generateAgentPrompt");
  }
}

async function generateAgentPrompt(): Promise<void> {
  if (!lastEvidencePacket) {
    vscode.window.showWarningMessage(
      'DoubtCatch: No evidence captured yet. Run "DoubtCatch: Capture Evidence" first.',
    );
    return;
  }

  const prompt = buildAgentPrompt(lastEvidencePacket);

  await vscode.env.clipboard.writeText(prompt);

  vscode.window.showInformationMessage(
    "DoubtCatch: Agent prompt copied to clipboard. Paste it into your AI coding agent.",
  );
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("DoubtCatch");

  context.subscriptions.push(
    output,

    vscode.commands.registerCommand("doubtcatch.captureEvidence", async () => {
      try {
        await captureEvidence(output);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(
          `DoubtCatch: Could not capture evidence — ${message}`,
        );
      }
    }),

    vscode.commands.registerCommand(
      "doubtcatch.generateAgentPrompt",
      generateAgentPrompt,
    ),
  );
}

export function deactivate() {
  lastEvidencePacket = undefined;
}
