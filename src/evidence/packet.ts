import { collectDiagnostics, DiagnosticEvidence } from "./diagnostics";
import { collectGitChanges } from "./git";
import {
  collectTerminalEvidence,
  TerminalCaptureOptions,
  TerminalEvidence,
} from "./terminal";
import { collectFileContext, FileContext } from "./context";
import { findRelevantFiles } from "./relevance";
import { redactSecrets } from "./redact";

/** Caps keep a noisy workspace from swamping the evidence. */
const MAX_DIAGNOSTICS = 50;
const MAX_GIT_CHANGES = 50;

/** The structured evidence passed through the whole DoubtCatch pipeline. */
export interface EvidencePacket {
  workspacePath: string;
  userSymptom: string;
  diagnostics: DiagnosticEvidence[];
  terminal?: TerminalEvidence;
  gitChanges: string[];
  fileContexts: FileContext[];
}

/**
 * Collects every available source of evidence into one packet.
 *
 * Terminal evidence is only gathered when a command is supplied, which happens
 * solely in response to an explicit user choice.
 */
export async function buildEvidencePacket(
  workspacePath: string,
  filePaths: string[],
  userSymptom = "",
  command?: string,
  args: string[] = [],
  terminalOptions: TerminalCaptureOptions = {},
): Promise<EvidencePacket> {
  const relevantFiles = findRelevantFiles(workspacePath, filePaths[0]);

  return {
    workspacePath,
    userSymptom: redactSecrets(userSymptom),
    diagnostics: collectDiagnostics()
      .slice(0, MAX_DIAGNOSTICS)
      .map((diagnostic) => ({
        ...diagnostic,
        message: redactSecrets(diagnostic.message),
      })),
    terminal: command
      ? await collectTerminalEvidence(command, args, {
          cwd: workspacePath,
          ...terminalOptions,
        })
      : undefined,
    gitChanges: collectGitChanges(workspacePath).slice(0, MAX_GIT_CHANGES),
    fileContexts: relevantFiles.map((file) =>
      collectFileContext(file.file, file.reason),
    ),
  };
}
