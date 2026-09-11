import * as vscode from 'vscode';

export interface DiagnosticEvidence {
    file: string;
    line: number;
    severity: string;
    message: string;
}

export function collectDiagnostics(): DiagnosticEvidence[] {
    const evidence: DiagnosticEvidence[] = [];

    for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
        for (const diagnostic of diagnostics) {
            evidence.push({
                file: vscode.workspace.asRelativePath(uri),
                line: diagnostic.range.start.line + 1,
                severity: diagnostic.severity === vscode.DiagnosticSeverity.Error
                    ? 'error'
                    : diagnostic.severity === vscode.DiagnosticSeverity.Warning
                        ? 'warning'
                        : 'info',
                message: diagnostic.message,
            });
        }
    }

    return evidence;
}