import * as vscode from "vscode";
import { buildEvidencePacket, EvidencePacket } from "./evidence/packet";
import { writeEvidenceToOutput } from "./evidence/output";
import { hasShellOperator, parseCommandLine } from "./evidence/commandLine";
import { buildAgentPrompt } from "./ai/prompt";
import { DoubtCatchViewProvider } from "./sidebar";

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

async function captureEvidence(
  output: vscode.OutputChannel,
  inputs: { symptom?: string; commandLine?: string; notify?: boolean } = {},
): Promise<EvidencePacket | undefined> {
  const workspace = vscode.workspace.workspaceFolders?.[0];

  if (!workspace) {
    vscode.window.showWarningMessage(
      "DoubtCatch: Open a folder or workspace before capturing evidence.",
    );
    return undefined;
  }

  const userSymptom = inputs.symptom ?? (await vscode.window.showInputBox({
    title: "DoubtCatch: Capture Evidence",
    prompt: "What problem are you seeing?",
    placeHolder: "Example: The save button does not save the member",
  }));

  if (userSymptom === undefined) {
    return undefined;
  }

  const tokens = inputs.commandLine !== undefined
    ? parseCommandLine(inputs.commandLine)
    : await askForTerminalCommand();
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

  const action = inputs.notify === false
    ? undefined
    : await vscode.window.showInformationMessage(
        `DoubtCatch: Evidence captured — ${summary}.`,
        generate,
      );

  if (action === generate) {
    await vscode.commands.executeCommand("doubtcatch.generateAgentPrompt");
  }

  return packet;
}

async function generateAgentPrompt(notify = true): Promise<boolean> {
  if (!lastEvidencePacket) {
    if (notify) {
      vscode.window.showWarningMessage(
        'DoubtCatch: No evidence captured yet. Run "DoubtCatch: Capture Evidence" first.',
      );
    }
    return false;
  }

  const prompt = buildAgentPrompt(lastEvidencePacket);

  await vscode.env.clipboard.writeText(prompt);

  if (notify) {
    vscode.window.showInformationMessage(
      "DoubtCatch: Agent prompt copied to clipboard. Paste it into your AI coding agent.",
    );
  }

  return true;
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("DoubtCatch");
  const sidebar = new DoubtCatchViewProvider(context.extensionUri, {
    capture: async () => {
      try {
        return Boolean(
          await vscode.commands.executeCommand("doubtcatch.captureEvidence"),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(
          `DoubtCatch: Could not capture evidence — ${message}`,
        );
        return false;
      }
    },
    generate: async () =>
      await vscode.commands.executeCommand<boolean>(
        "doubtcatch.generateAgentPrompt",
        false,
      ),
  });

  context.subscriptions.push(
    output,
    vscode.window.registerWebviewViewProvider(DoubtCatchViewProvider.viewType, sidebar),
    vscode.commands.registerCommand("doubtcatch.focus", () =>
      vscode.commands.executeCommand("workbench.view.extension.doubtcatch"),
    ),

    vscode.commands.registerCommand("doubtcatch.captureEvidence", async () => {
      try {
        const packet = await captureEvidence(output);
        return Boolean(packet);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(
          `DoubtCatch: Could not capture evidence — ${message}`,
        );
        return false;
      }
    }),

    vscode.commands.registerCommand(
      "doubtcatch.generateAgentPrompt",
      (notify?: boolean) => generateAgentPrompt(notify),
    ),
  );
}

export function deactivate() {
  lastEvidencePacket = undefined;
}
