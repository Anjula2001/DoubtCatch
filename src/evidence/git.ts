import { execFileSync } from 'child_process';

export function collectGitChanges(workspacePath: string): string[] {
    const output = execFileSync(
        'git',
        ['diff', '--name-only'],
        {
            cwd: workspacePath,
            encoding: 'utf-8',
        }
    );

    return output
        .split('\n')
        .map(file => file.trim())
        .filter(Boolean);
}