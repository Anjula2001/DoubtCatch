import { collectDiagnostics, DiagnosticEvidence } from './diagnostics';
import { collectGitChanges } from './git';
import { collectTerminalEvidence, TerminalEvidence } from './terminal';
import { collectFileContext, FileContext } from './context';

export interface EvidencePacket {
    diagnostics: DiagnosticEvidence[];
    gitChanges: string[];
    terminal?: TerminalEvidence;
    fileContexts: FileContext[];
}

export function buildEvidencePacket(
    workspacePath: string,
    filePaths: string[],
    command?: string,
    args: string[] = []
): EvidencePacket {
    return {
        diagnostics: collectDiagnostics(),
        gitChanges: collectGitChanges(workspacePath),
        terminal: command
            ? collectTerminalEvidence(command, args)
            : undefined,
        fileContexts: filePaths.map(file => collectFileContext(file)),
    };
}