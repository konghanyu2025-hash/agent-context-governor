const SECRET_VALUE = "[REDACTED]";

const secretPatterns: RegExp[] = [
  /\b(sk-[A-Za-z0-9_-]{12,})\b/gu,
  /\b(gh[pousr]_[A-Za-z0-9_]{20,})\b/gu,
  /\b(xox[baprs]-[A-Za-z0-9-]{20,})\b/gu,
  /\b(AKIA[0-9A-Z]{16})\b/gu,
  /\b((?:api[_-]?key|access[_-]?token|auth[_-]?token|secret|password|authorization)\s*[:=]\s*)(["']?)[^\s"',;]+/giu
];

const windowsHomePattern = /\b[A-Z]:\\Users\\([^\\\s]+)(?=\\)/giu;
const posixHomePattern = /\/Users\/([^/\s]+)(?=\/)|\/home\/([^/\s]+)(?=\/)/giu;

export function redactString(value: string): string {
  let redacted = value;

  for (const pattern of secretPatterns) {
    redacted = redacted.replace(pattern, (match, prefix?: string, quote?: string) => {
      if (prefix && /[:=]/u.test(prefix)) {
        return `${prefix}${quote ?? ""}${SECRET_VALUE}`;
      }

      return SECRET_VALUE;
    });
  }

  return redacted
    .replace(windowsHomePattern, "~")
    .replace(posixHomePattern, "~");
}

export function redactDeep<T>(value: T): T {
  if (typeof value === "string") {
    return redactString(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item)) as T;
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(value)) {
      if (/^(env|environment)$/iu.test(key) && nested && typeof nested === "object") {
        result[key] = redactEnvironment(nested as Record<string, unknown>);
      } else {
        result[key] = redactDeep(nested);
      }
    }

    return result as T;
  }

  return value;
}

function redactEnvironment(environment: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(environment)) {
    if (/(token|secret|password|key|authorization)/iu.test(key)) {
      result[key] = SECRET_VALUE;
    } else {
      result[key] = redactDeep(value);
    }
  }

  return result;
}
