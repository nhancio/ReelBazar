const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ANGLE_BRACKETS_REGEX = /[<>]/g;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export class ValidationError extends Error {}

interface StringOptions {
  minLength?: number;
  maxLength: number;
  allowEmpty?: boolean;
  preserveNewlines?: boolean;
}

export function normalizeString(value: unknown, options: StringOptions): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ValidationError('Expected a string value');
  }

  let normalized = value.replace(CONTROL_CHARS_REGEX, '');
  normalized = normalized.replace(ANGLE_BRACKETS_REGEX, '');
  normalized = options.preserveNewlines
    ? normalized.replace(/[^\S\r\n]+/g, ' ').trim()
    : normalized.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    if (options.allowEmpty) return null;
    throw new ValidationError('Value cannot be empty');
  }

  if (options.minLength && normalized.length < options.minLength) {
    throw new ValidationError(`Value must be at least ${options.minLength} characters`);
  }

  if (normalized.length > options.maxLength) {
    throw new ValidationError(`Value must be at most ${options.maxLength} characters`);
  }

  return normalized;
}

export function normalizeOptionalEmail(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const email = normalizeString(value, { maxLength: 320 })?.toLowerCase() ?? null;
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new ValidationError('Invalid email format');
  }
  return email;
}

export function normalizeOptionalUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const raw = normalizeString(value, { maxLength: 2048 }) ?? null;
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ValidationError('URL must be valid');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ValidationError('URL protocol must be http or https');
  }

  return url.toString();
}

export function normalizeStringArray(
  value: unknown,
  options: { maxItems: number; maxLength: number }
): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ValidationError('Expected an array value');
  }

  const normalized = value
    .map((item) => normalizeString(item, { maxLength: options.maxLength, allowEmpty: true }))
    .filter((item): item is string => Boolean(item));

  const unique = Array.from(new Set(normalized));
  if (unique.length > options.maxItems) {
    throw new ValidationError(`Array must contain at most ${options.maxItems} items`);
  }

  return unique;
}

export function normalizeThemePreference(value: unknown): 'dark' | 'light' | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (value !== 'dark' && value !== 'light') {
    throw new ValidationError('themePreference must be dark or light');
  }

  return value;
}

export function parseIntegerQuery(value: unknown, fallback: number, max: number): number {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

export function normalizeDocumentId(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} is required`);
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128 || trimmed.includes('/')) {
    throw new ValidationError(`${fieldName} is invalid`);
  }

  return trimmed;
}
