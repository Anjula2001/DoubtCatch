import { EvidencePacket } from "../evidence/packet";

export function buildAgentPrompt(packet: EvidencePacket): string {
  const sections: string[] = [];

  sections.push(
    "You are debugging a software issue. Analyze the evidence below and identify the most likely root cause."
  );

  sections.push(
    "Do not modify unrelated files. Base your reasoning on the provided evidence."
  );

  sections.push(`User Symptom:
${packet.userSymptom}`);

  sections.push(`Diagnostics:
${JSON.stringify(packet.diagnostics, null, 2)}`);

  sections.push(`Git Changes:
${JSON.stringify(packet.gitChanges, null, 2)}`);

  if (packet.terminal) {
    sections.push(`Terminal Evidence:
${JSON.stringify(packet.terminal, null, 2)}`);
  }

  sections.push(
    `Relevant Files:
${packet.fileContexts
  .map(
    (file) => `File: ${file.file}

${file.content}`,
  )
  .join("\n\n")}`,
  );

  sections.push(
    "Explain the likely root cause, the evidence supporting it, and the smallest appropriate fix."
  );

  return sections.join("\n\n");
}