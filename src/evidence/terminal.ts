export interface TerminalEvidence {
    command: string;
    output: string;
    exitCode: number;
}

import { execFileSync } from 'child_process';

export function collectTerminalEvidence(
    command: string,
    args: string[] = []
): TerminalEvidence {
    try {
        const output = execFileSync(command, args, {
            encoding: 'utf-8',
            stdio: 'pipe',
        });

        return {
            command: [command, ...args].join(' '),
            output,
            exitCode: 0,
        };
    } catch (error) {
        const err = error as {
            stdout?: Buffer | string;
            stderr?: Buffer | string;
            status?: number | null;
        };

        const stdout = err.stdout?.toString() ?? '';
        const stderr = err.stderr?.toString() ?? '';

        return {
            command: [command, ...args].join(' '),
            output: `${stdout}${stderr}`,
            exitCode: err.status ?? 1,
        };
    }
}