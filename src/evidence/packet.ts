import { collectDiagnostics, DiagnosticEvidence } from './diagnostics';
import { collectGitChanges } from './git';
import { collectTerminalEvidence, TerminalEvidence } from './terminal';
import { collectFileContext, FileContext } from './context';
import { findRelevantFiles } from "./relevance";

export interface EvidencePacket {
  userSymptom: string;
  diagnostics: DiagnosticEvidence[];
  gitChanges: string[];
  terminal?: TerminalEvidence;
  fileContexts: FileContext[];
}

export function buildEvidencePacket(
  workspacePath: string,
  filePaths: string[],
  userSymptom = "",
  command?: string,
  args: string[] = [],
): EvidencePacket {
    return {
      userSymptom,
        diagnostics: collectDiagnostics(),
        gitChanges: collectGitChanges(workspacePath),
        terminal: command
            ? collectTerminalEvidence(command, args)
            : undefined,
        fileContexts: findRelevantFiles(
  workspacePath,
  filePaths[0],
).map(file => collectFileContext(file.file)),
    };
}