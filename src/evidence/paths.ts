import { isAbsolute, relative } from "path";

/**
 * Renders a path relative to the workspace when it lives inside it, so evidence
 * reads the way a developer refers to their own files.
 */
export function toDisplayPath(workspacePath: string, file: string): string {
  if (!workspacePath || !isAbsolute(file)) {
    return file;
  }

  const relativePath = relative(workspacePath, file);

  return relativePath && !relativePath.startsWith("..")
    ? relativePath
    : file;
}
