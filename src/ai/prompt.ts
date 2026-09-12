import { EvidencePacket } from "../evidence/packet";
import { toDisplayPath } from "../evidence/paths";
import { redactSecrets } from "../evidence/redact";

/**
 * Picks a fence longer than any backtick run in the content, so file contents
 * that themselves contain Markdown fences cannot break out of their block.
 */
function fenceFor(content: string): string {
  const longestRun = [...content.matchAll(/`+/g)].reduce(
    (longest, match) => Math.max(longest, match[0].length),
    0,
  );

  return "`".repeat(Math.max(3, longestRun + 1));
}

function fenced(content: string): string {
  const body = content.trimEnd();
  const fence = fenceFor(body);
  return `${fence}\n${body}\n${fence}`;
}

/**
 * Builds a self-contained, evidence-first prompt to paste into any AI coding
 * agent. All evidence is redacted before it reaches the prompt text.
 */
export function buildAgentPrompt(packet: EvidencePacket): string {
  const sections: string[] = [];

  sections.push(
    "You are debugging a real problem in an existing codebase. Evidence collected from the developer's editor, Git working tree and terminal is below. Work from that evidence rather than from assumptions about what the code is supposed to do.",
  );

  sections.push(
    `## Observed problem\n\n${packet.userSymptom.trim() || "(the developer did not describe the symptom)"}`,
  );

  sections.push(
    `## Editor diagnostics\n\n${
      packet.diagnostics.length === 0
        ? "None reported."
        : packet.diagnostics
            .map(
              (diagnostic) =>
                `- [${diagnostic.severity}] ${diagnostic.file}:${diagnostic.line} — ${diagnostic.message}`,
            )
            .join("\n")
    }`,
  );

  sections.push(
    `## Terminal evidence\n\n${
      packet.terminal
        ? `Command: \`${packet.terminal.command}\`\nExit code: ${packet.terminal.exitCode}${
            packet.terminal.timedOut ? " (timed out)" : ""
          }\n\nOutput:\n\n${fenced(packet.terminal.output.trimEnd() || "(no output)")}`
        : "Not captured."
    }`,
  );

  sections.push(
    `## Uncommitted Git changes\n\n${
      packet.gitChanges.length === 0
        ? "None."
        : packet.gitChanges.map((change) => `- ${change}`).join("\n")
    }`,
  );

  sections.push(
    `## Relevant files\n\n${
      packet.fileContexts.length === 0
        ? "None captured."
        : packet.fileContexts
            .map((file) => {
              const path = toDisplayPath(packet.workspacePath, file.file);
              const reason = file.reason ? ` (${file.reason})` : "";
              return `### ${path}${reason}\n\n${fenced(file.content)}`;
            })
            .join("\n\n")
    }`,
  );

  sections.push(
    [
      "## What to do",
      "",
      "1. Identify the most likely root cause, citing the specific evidence above that supports it.",
      "2. State which evidence would contradict your explanation if it were wrong.",
      "3. Propose the smallest appropriate fix. Do not refactor, rename, reformat or modify files unrelated to this problem.",
      "4. Explain how the proposed fix changes the observed failure, and how the developer can confirm it.",
      "",
      "Do not assume the issue is fixed merely because the code looks correct. Use the provided evidence to identify the root cause and explain how the proposed fix addresses the observed failure.",
      "",
      "If the evidence is not sufficient to determine the root cause, say so and name the specific additional evidence you need.",
    ].join("\n"),
  );

  // Defence in depth: collectors already redact, this catches anything assembled here.
  return redactSecrets(sections.join("\n\n"));
}
