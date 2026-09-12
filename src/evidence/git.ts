import { execFileSync } from "child_process";

/** Porcelain status codes mapped to a word an agent can read directly. */
function describeStatus(code: string): string {
  if (code.includes("?")) {
    return "untracked";
  }
  if (code.includes("R")) {
    return "renamed";
  }
  if (code.includes("A")) {
    return "added";
  }
  if (code.includes("D")) {
    return "deleted";
  }
  return "modified";
}

/**
 * Lists files changed in the working tree, including staged and untracked
 * files, since an AI agent's edits commonly land in all three states.
 * Returns an empty list when the workspace is not a Git repository.
 */
export function collectGitChanges(workspacePath: string): string[] {
  let output: string;

  try {
    output = execFileSync("git", ["status", "--porcelain"], {
      cwd: workspacePath,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return [];
  }

  return output
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const status = describeStatus(line.slice(0, 2));
      let file = line.slice(2).trim();

      // Renames are reported as "old -> new"; the new path is what matters.
      const renameSeparator = file.indexOf(" -> ");
      if (renameSeparator !== -1) {
        file = file.slice(renameSeparator + 4);
      }

      return `${file} (${status})`;
    });
}
