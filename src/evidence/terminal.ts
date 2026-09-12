import { execFile } from "child_process";
import { redactSecrets } from "./redact";
import { truncateTail } from "./truncate";

/** Commands are bounded so a hung process cannot stall evidence capture. */
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_BUFFER_BYTES = 4 * 1024 * 1024;
const MAX_TERMINAL_OUTPUT_CHARS = 8000;

export interface TerminalEvidence {
  command: string;
  output: string;
  exitCode: number;
  /** Set only when the command was killed for exceeding the timeout. */
  timedOut?: boolean;
}

export interface TerminalCaptureOptions {
  cwd?: string;
  timeoutMs?: number;
}

interface ExecFailure extends Error {
  code?: number | string;
  killed?: boolean;
}

function finalize(output: string): string {
  return truncateTail(redactSecrets(output), MAX_TERMINAL_OUTPUT_CHARS);
}

/**
 * Runs a command and captures stdout, stderr and the exit code.
 *
 * The command and its arguments are passed to execFile as a structured
 * argument list with no shell, so argument content cannot be interpreted as
 * further shell commands.
 */
export function collectTerminalEvidence(
  command: string,
  args: string[] = [],
  options: TerminalCaptureOptions = {},
): Promise<TerminalEvidence> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const label = redactSecrets([command, ...args].join(" "));

  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        cwd: options.cwd,
        encoding: "utf-8",
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER_BYTES,
        shell: false,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const combined = `${stdout ?? ""}${stderr ?? ""}`;

        if (!error) {
          resolve({
            command: label,
            output: finalize(combined),
            exitCode: 0,
          });
          return;
        }

        const failure = error as ExecFailure;
        const timedOut = failure.killed === true;
        const notes: string[] = [];

        if (timedOut) {
          notes.push(
            `[DoubtCatch] Command timed out after ${timeoutMs}ms and was terminated.`,
          );
        }

        if (typeof failure.code === "string") {
          notes.push(
            `[DoubtCatch] Command could not be run (${failure.code}): ${failure.message}`,
          );
        }

        const evidence: TerminalEvidence = {
          command: label,
          output: finalize([combined, ...notes].filter(Boolean).join("\n")),
          exitCode:
            typeof failure.code === "number"
              ? failure.code
              : timedOut
                ? 124
                : 1,
        };

        if (timedOut) {
          evidence.timedOut = true;
        }

        resolve(evidence);
      },
    );
  });
}
