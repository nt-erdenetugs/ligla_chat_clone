/**
 * Validates if a regex pattern is compatible with RE2 engine.
 *
 * RE2 has limitations compared to JavaScript RegExp:
 * - No backreferences (\1, \2, etc.)
 * - No lookahead/lookbehind assertions (?=, ?!, ?<=, ?<!)
 * - No atomic groups (?>...)
 * - No conditional patterns (?(...)...)
 * - No recursive patterns
 *
 * This validation helps prevent errors when the pattern is used on the backend
 * with google-re2, which uses Google's RE2 engine.
 *
 * @param pattern - The regex pattern to validate
 * @returns Object with isValid boolean and error message if invalid
 */
export const validateRe2Pattern = (pattern: string): { isValid: boolean; error?: string } => {
  if (!pattern || pattern.trim().length === 0) {
    return { isValid: false, error: 'Pattern cannot be empty' };
  }

  try {
    new RegExp(pattern);
  } catch (_error) {
    return { isValid: false, error: 'Invalid regex pattern syntax' };
  }

  // Check for backreferences (RE2 doesn't support them)
  // Backreferences: \1, \2, ..., \9, \10, etc., or \k<name>
  const backreferencePattern = /\\([1-9]\d*|k<[^>]+>)/;
  if (backreferencePattern.test(pattern)) {
    return {
      isValid: false,
      error: 'RE2 does not support backreferences (\\1, \\2, etc.)',
    };
  }

  // Check for lookahead assertions (RE2 doesn't support them)
  // Positive lookahead: (?=...)
  // Negative lookahead: (?!...)
  const lookaheadPattern = /\(\?[=!]/;
  if (lookaheadPattern.test(pattern)) {
    return {
      isValid: false,
      error: 'RE2 does not support lookahead assertions (?=, ?!)',
    };
  }

  // Check for lookbehind assertions (RE2 doesn't support them)
  // Positive lookbehind: (?<=...)
  // Negative lookbehind: (?<!...)
  const lookbehindPattern = /\(\?<[=!]/;
  if (lookbehindPattern.test(pattern)) {
    return {
      isValid: false,
      error: 'RE2 does not support lookbehind assertions (?<=, ?<!)',
    };
  }

  // Check for atomic groups (RE2 doesn't support them)
  // Atomic group: (?>...)
  const atomicGroupPattern = /\(\?>/;
  if (atomicGroupPattern.test(pattern)) {
    return {
      isValid: false,
      error: 'RE2 does not support atomic groups (?>...)',
    };
  }

  // Check for conditional patterns (RE2 doesn't support them)
  // Conditional: (?(condition)yes|no)
  const conditionalPattern = /\(\?\(/;
  if (conditionalPattern.test(pattern)) {
    return {
      isValid: false,
      error: 'RE2 does not support conditional patterns (?(...)...)',
    };
  }

  return { isValid: true };
};
