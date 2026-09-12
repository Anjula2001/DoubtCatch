/** Operators that only mean something to a shell, which DoubtCatch never uses. */
const SHELL_OPERATORS = new Set(["&&", "||", ";", "|", ">", ">>", "<", "&"]);

/**
 * Splits a command line the user typed into a command and its arguments,
 * honouring simple single and double quoting.
 *
 * No shell is involved, here or downstream: the result is handed to execFile as
 * a structured argument list, so nothing in the input can start a new command.
 */
export function parseCommandLine(input: string): string[] {
  const tokens: string[] = [];

  let current = "";
  let inToken = false;
  let quote: string | undefined;

  for (const char of input.trim()) {
    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      inToken = true;
      continue;
    }

    if (/\s/.test(char)) {
      if (inToken) {
        tokens.push(current);
        current = "";
        inToken = false;
      }
      continue;
    }

    current += char;
    inToken = true;
  }

  if (inToken) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * True when the tokens contain a shell operator, which will be passed through
 * as a literal argument rather than interpreted.
 */
export function hasShellOperator(tokens: string[]): boolean {
  return tokens.some((token) => SHELL_OPERATORS.has(token));
}
