/**
 * Validates and normalizes international phone numbers according to E.164 standard.
 * Accepts formats starting with '+' followed by 7 to 15 digits, allowing optional spaces,
 * dots, dashes, or parentheses that will be stripped during normalization.
 */
export function normalizeAndValidateDestination(rawDestination: unknown): {
  isValid: boolean;
  normalized?: string;
  error?: string;
} {
  if (typeof rawDestination !== 'string') {
    return {
      isValid: false,
      error: 'Destination must be a non-empty string in international format (e.g., +8801XXXXXXXXX or +12025550123)',
    };
  }

  const trimmed = rawDestination.trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: 'Destination phone number is required',
    };
  }

  // Remove spaces, hyphens, parentheses, dots
  const stripped = trimmed.replace(/[\s\-\(\)\.]/g, '');

  // International numbers MUST start with '+' and have between 7 and 15 digits
  const e164Regex = /^\+[1-9]\d{6,14}$/;

  if (!e164Regex.test(stripped)) {
    return {
      isValid: false,
      error: `Invalid international destination format '${trimmed}'. Destination must start with '+' followed by 7 to 15 digits (E.164 format, e.g. +8801712345678).`,
    };
  }

  return {
    isValid: true,
    normalized: stripped,
  };
}
