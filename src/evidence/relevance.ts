import { readFileSync, statSync } from "fs";
import { basename, dirname, join, resolve } from "path";

/** Keeps the generated prompt focused on a handful of files. */
const MAX_RELEVANT_FILES = 8;

/**
 * Extensions tried when an import omits one. V1 deliberately supports only
 * JavaScript/TypeScript relative imports; additional languages can be added by
 * introducing another resolver alongside resolveRelativeImport.
 */
const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
];

const RELATIVE_IMPORT_PATTERN =
  /(?:import\s+(?:[\s\S]*?\s+from\s+)?|require\()\s*["'](\.{1,2}\/[^"']+)["']\s*\)?/g;

export interface RelevantFile {
  file: string;
  reason: string;
}

function isFile(candidate: string): boolean {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolves a relative import the way Node does, checking the literal path, then
 * each known extension, then an index file inside a directory of that name.
 */
function resolveRelativeImport(
  fromDirectory: string,
  importPath: string,
): string | undefined {
  const base = resolve(fromDirectory, importPath);

  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => join(base, `index${extension}`)),
  ];

  return candidates.find(isFile);
}

/**
 * Returns the active file plus the local files it imports directly.
 * This is a single-level scan, not a dependency graph.
 */
export function findRelevantFiles(
  workspacePath: string,
  activeFile?: string,
): RelevantFile[] {
  if (!activeFile || !isFile(activeFile)) {
    return [];
  }

  const files = new Map<string, RelevantFile>();

  files.set(activeFile, {
    file: activeFile,
    reason: "Active file",
  });

  let content: string;

  try {
    content = readFileSync(activeFile, "utf-8");
  } catch {
    return Array.from(files.values());
  }

  const activeDirectory = dirname(activeFile);

  for (const match of content.matchAll(RELATIVE_IMPORT_PATTERN)) {
    if (files.size >= MAX_RELEVANT_FILES) {
      break;
    }

    const importPath = match[1];

    if (!importPath) {
      continue;
    }

    const resolved = resolveRelativeImport(activeDirectory, importPath);

    if (resolved && !files.has(resolved)) {
      files.set(resolved, {
        file: resolved,
        reason: `Imported by ${basename(activeFile)}`,
      });
    }
  }

  return Array.from(files.values());
}
