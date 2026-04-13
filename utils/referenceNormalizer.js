/**
 * Reference Normalization Utility
 * Ensures consistent reference handling across the entire payment system
 */

/**
 * Normalize a reference string
 * - Trim whitespace
 * - Convert to uppercase
 * - Remove any hidden characters
 * 
 * @param {string} ref - Raw reference string
 * @returns {string} - Normalized reference
 */
export const normalizeReference = (ref) => {
  if (!ref) return '';
  
  // Convert to string, trim, and uppercase
  const normalized = String(ref)
    .trim()
    .toUpperCase()
    .replace(/[\r\n\t]/g, ''); // Remove hidden characters
  
  return normalized;
};

/**
 * Validate reference format
 * Should start with TXN_ and be ~22 characters
 * 
 * @param {string} ref - Reference to validate
 * @returns {boolean} - True if valid format
 */
export const isValidReferenceFormat = (ref) => {
  const normalized = normalizeReference(ref);
  return normalized.startsWith('TXN_') && normalized.length >= 20;
};

/**
 * Log reference for debugging
 * Shows raw, normalized, and hidden characters
 * 
 * @param {string} label - Debug label
 * @param {string} ref - Reference to log
 */
export const logReference = (label, ref) => {
  const normalized = normalizeReference(ref);
  console.log(`${label}:`, {
    raw: ref,
    normalized,
    length: normalized.length,
    rawJSON: JSON.stringify(ref),
    startsWithTXN: normalized.startsWith('TXN_'),
  });
};
