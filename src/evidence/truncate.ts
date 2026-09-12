/** Marker appended or prepended where DoubtCatch has dropped content. */
function marker(omittedChars: number, position: "end" | "start"): string {
  const where = position === "end" ? "more" : "earlier";
  return `... [truncated by DoubtCatch: ${omittedChars} ${where} characters omitted]`;
}

/** Keeps the beginning of the text. Used for source files. */
export function truncateHead(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}\n${marker(text.length - maxChars, "end")}`;
}

/** Keeps the end of the text. Used for command output, where failures land last. */
export function truncateTail(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  return `${marker(text.length - maxChars, "start")}\n${text.slice(-maxChars)}`;
}
