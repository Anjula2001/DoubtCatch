import { readFileSync } from "fs";
import { redactSecrets } from "./redact";
import { truncateHead } from "./truncate";

/** Keeps a single file from dominating the generated prompt. */
const MAX_FILE_CONTEXT_CHARS = 8000;

export interface FileContext {
  file: string;
  /** Why this file was included, e.g. "Active file". */
  reason?: string;
  content: string;
}

/**
 * Reads a file for use as evidence. Content is redacted at the point of read,
 * so a FileContext never carries an obvious secret downstream.
 */
export function collectFileContext(
  filePath: string,
  reason?: string,
): FileContext {
  let content: string;

  try {
    content = readFileSync(filePath, "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    content = `[DoubtCatch could not read this file: ${message}]`;
  }

  return {
    file: filePath,
    reason,
    content: truncateHead(redactSecrets(content), MAX_FILE_CONTEXT_CHARS),
  };
}
