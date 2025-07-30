/**
 * Phone number normalization utilities
 */

/**
 * Normalize phone number to a consistent format
 * Removes spaces, dashes, parentheses and ensures consistent international format with + prefix
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) {
    return '';
  }

  // Remove all non-digit characters except the leading +
  let normalized = phoneNumber.replace(/[^\d+]/g, '');
  
  // If it starts with + keep it, otherwise remove any + in the middle
  if (normalized.startsWith('+')) {
    normalized = '+' + normalized.substring(1).replace(/\+/g, '');
  } else {
    normalized = normalized.replace(/\+/g, '');
  }

  // Add + prefix for valid international numbers that don't have it
  // Only add + if the number is at least 10 digits and starts with a valid digit
  if (!normalized.startsWith('+') && normalized.length >= 10 && /^[1-9]/.test(normalized)) {
    normalized = '+' + normalized;
  }

  // Add logging for debugging
  if (phoneNumber !== normalized) {
    console.log(`📱 Phone number normalized: "${phoneNumber}" → "${normalized}"`);
  }

  return normalized;
}

/**
 * Validate if phone number is in a reasonable format
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const normalized = normalizePhoneNumber(phoneNumber);
  
  // Should be at least 10 digits, can start with +
  const phoneRegex = /^\+?[1-9]\d{9,14}$/;
  return phoneRegex.test(normalized);
}

/**
 * Get display format for phone number (for UI)
 */
export function formatPhoneNumberForDisplay(phoneNumber: string): string {
  const normalized = normalizePhoneNumber(phoneNumber);
  
  // If it's a common format, add some spacing for readability
  if (normalized.startsWith('+91') && normalized.length === 13) {
    // Indian number format: +91 98765 43210
    return `${normalized.slice(0, 3)} ${normalized.slice(3, 8)} ${normalized.slice(8)}`;
  } else if (normalized.startsWith('+1') && normalized.length === 12) {
    // US number format: +1 234-567-8900
    return `${normalized.slice(0, 2)} ${normalized.slice(2, 5)}-${normalized.slice(5, 8)}-${normalized.slice(8)}`;
  }
  
  return normalized;
}

/**
 * Extract country code from phone number
 */
export function getCountryCodeFromPhoneNumber(phoneNumber: string): string | null {
  const normalized = normalizePhoneNumber(phoneNumber);
  
  if (!normalized.startsWith('+')) {
    return null;
  }
  
  // Common country codes
  const countryCodes = ['91', '1', '44', '49', '33', '86', '81', '7'];
  
  for (const code of countryCodes) {
    if (normalized.startsWith(`+${code}`)) {
      return code;
    }
  }
  
  // Try to extract first 1-3 digits after +
  const match = normalized.match(/^\+(\d{1,3})/);
  return match ? match[1] : null;
} 