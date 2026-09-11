import { existsSync, readFileSync } from "fs";
import { dirname, extname, join, resolve } from "path";

export interface RelevantFile {
  file: string;
  reason: string;
}

export function findRelevantFiles(
  workspacePath: string,
  activeFile?: string,
): RelevantFile[] {
  if (!activeFile || !existsSync(activeFile)) {
    return [];
  }

  const files = new Map<string, RelevantFile>();

  files.set(activeFile, {
    file: activeFile,
    reason: "Active file",
  });

  const content = readFileSync(activeFile, "utf-8");

  const importPattern =
    /(?:import\s+(?:[\s\S]*?\s+from\s+)?|require\()\s*["'](\.{1,2}\/[^"']+)["']\s*\)?/g;

  const activeDirectory = dirname(activeFile);

  for (const match of content.matchAll(importPattern)) {
    const importPath = match[1];

    if (!importPath) {
      continue;
    }

    const absolutePath = resolve(activeDirectory, importPath);

    const candidates = [
      absolutePath,
      `${absolutePath}.ts`,
      `${absolutePath}.tsx`,
      `${absolutePath}.js`,
      `${absolutePath}.jsx`,
      join(absolutePath, "index.ts"),
      join(absolutePath, "index.tsx"),
      join(absolutePath, "index.js"),
    ];

    const existingFile = candidates.find(
      (candidate) => existsSync(candidate) && extname(candidate),
    );

    if (existingFile) {
      files.set(existingFile, {
        file: existingFile,
        reason: `Imported by ${activeFile}`,
      });
    }
  }

  return Array.from(files.values());
}