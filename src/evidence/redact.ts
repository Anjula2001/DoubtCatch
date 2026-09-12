/**
 * Heuristic redaction of obviously sensitive values.
 *
 * This is best-effort protection, not a guarantee. It is tuned to preserve the
 * shape of real source code: assignment rules keep the key and the quotes and
 * replace only the value, so an agent reading the evidence still sees the code
 * structure without seeing the secret itself.
 */

export const REDACTION_PLACEHOLDER = "[REDACTED_SECRET]";

/** Key names that suggest the assigned value is a credential. */
const SECRET_KEY_WORDS = [
  "password",
  "passwd",
  "pwd",
  "passphrase",
  "secret",
  "token",
  "api[_-]?key",
  "apikey",
  "access[_-]?key",
  "auth[_-]?token",
  "authorization",
  "credentials?",
  "private[_-]?key",
  "client[_-]?secret",
  "conn(?:ection)?[_-]?string",
].join("|");

/** Same list, restricted to the UPPER_SNAKE spelling used by environment files. */
const ENV_SECRET_KEY_WORDS = [
  "PASSWORD",
  "PASSWD",
  "PWD",
  "PASSPHRASE",
  "SECRET",
  "TOKEN",
  "API_?KEY",
  "APIKEY",
  "ACCESS_?KEY",
  "AUTH_?TOKEN",
  "AUTHORIZATION",
  "CREDENTIALS?",
  "PRIVATE_?KEY",
  "CLIENT_SECRET",
  "CONN(?:ECTION)?_?STRING",
].join("|");

interface RedactionRule {
  pattern: RegExp;
  replace: (...groups: string[]) => string;
}

/**
 * Rules run in order. Value-shaped rules run first so that structural rules
 * later in the list see (and harmlessly re-redact) an already-safe value.
 */
const RULES: RedactionRule[] = [
  // PEM / OpenSSH private key blocks, including the body.
  {
    pattern: /-----BEGIN[A-Z ]*PRIVATE KEY-----[\s\S]*?-----END[A-Z ]*PRIVATE KEY-----/g,
    replace: () => REDACTION_PLACEHOLDER,
  },

  // Credentials embedded in a connection URI: keep scheme, user and host.
  {
    pattern: /\b([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^\s:/@]+):([^\s:/@]+)@/g,
    replace: (_match, scheme, user) =>
      `${scheme}${user}:${REDACTION_PLACEHOLDER}@`,
  },

  // JWT-like three-segment tokens (a base64url "{"" header always starts eyJ).
  {
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    replace: () => REDACTION_PLACEHOLDER,
  },

  // Well-known provider token shapes, recognisable without a key name.
  {
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
    replace: () => REDACTION_PLACEHOLDER,
  },
  {
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
    replace: () => REDACTION_PLACEHOLDER,
  },
  {
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    replace: () => REDACTION_PLACEHOLDER,
  },
  {
    pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
    replace: () => REDACTION_PLACEHOLDER,
  },
  {
    pattern: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}/g,
    replace: () => REDACTION_PLACEHOLDER,
  },
  {
    pattern: /\bAIza[0-9A-Za-z_-]{35}/g,
    replace: () => REDACTION_PLACEHOLDER,
  },
  {
    pattern: /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}/g,
    replace: () => REDACTION_PLACEHOLDER,
  },
  {
    pattern: /\bnpm_[A-Za-z0-9]{30,}/g,
    replace: () => REDACTION_PLACEHOLDER,
  },

  // Authorization header values. The length floor and the "not a plain word"
  // guard keep prose like "Basic authentication" from matching.
  {
    pattern: /\b(Bearer|Basic)\s+(?![A-Za-z]+\b)[A-Za-z0-9._~+/=-]{16,}/g,
    replace: (_match, scheme) => `${scheme} ${REDACTION_PLACEHOLDER}`,
  },

  // Quoted assignment to a secret-looking key, in any language.
  // Keeps the key, the operator and the quote style.
  {
    pattern: new RegExp(
      `((?:^|[^A-Za-z0-9_])[A-Za-z0-9_.$-]*(?:${SECRET_KEY_WORDS})[A-Za-z0-9_$]*\\s*[:=]+\\s*)(["'\`])([^"'\`\\n]+)\\2`,
      "gi",
    ),
    replace: (_match, prefix, quote) =>
      `${prefix}${quote}${REDACTION_PLACEHOLDER}${quote}`,
  },

  // Unquoted environment-style assignment (.env, shell, CI yaml).
  // Restricted to UPPER_SNAKE keys and to values that are literals rather than
  // calls or subscripts, so ordinary code is left alone.
  {
    pattern: new RegExp(
      `((?:^|\\n)[ \\t]*(?:export[ \\t]+)?[A-Z0-9_]*(?:${ENV_SECRET_KEY_WORDS})[A-Z0-9_]*[ \\t]*=[ \\t]*)(?!["'\`])[^\\s#\\n()\\[\\]{}]+(?=[\\s#]|$)`,
    "g",
    ),
    replace: (_match, prefix) => `${prefix}${REDACTION_PLACEHOLDER}`,
  },
];

/**
 * Replaces values that look like credentials with {@link REDACTION_PLACEHOLDER}.
 * Safe to apply more than once: the result of redaction redacts to itself.
 */
export function redactSecrets(text: string): string {
  if (!text) {
    return text;
  }

  let redacted = text;

  for (const rule of RULES) {
    redacted = redacted.replace(
      rule.pattern,
      (...args: unknown[]) => {
        // String.replace passes offset and the full input after the groups.
        const groups = args.slice(0, -2) as string[];
        return rule.replace(...groups);
      },
    );
  }

  return redacted;
}
