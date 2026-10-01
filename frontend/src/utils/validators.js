/**
 * Central Strict Validation Utilities for Kirana ERP Frontend
 */

// Strict Email Regex: username@domain.tld
// - Local part: starts with alphanumeric; allows dots, plus signs, underscores, hyphens as separators
//   (no leading/trailing/consecutive separators). Supports plus-addressing: user+test@gmail.com
// - Domain name: MUST start with an alphabet letter [a-zA-Z], followed by letters, digits, or hyphens
//   (rejects domains starting with digits like 875gmail.com)
// - TLD: 2 to 10 letters (e.g. .com, .in, .org, .net, .co.in)
export const STRICT_EMAIL_REGEX = /^[a-zA-Z0-9]+(?:[.+_-][a-zA-Z0-9]+)*@[a-zA-Z][a-zA-Z0-9-]*(?:\.[a-zA-Z][a-zA-Z0-9-]*)*\.[a-zA-Z]{2,10}$/;

export const INVALID_EMAIL_MESSAGE = "Please enter a valid email address.";

/**
 * Validates strict email format.
 * @param {string} email
 * @returns {boolean}
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false;
  return STRICT_EMAIL_REGEX.test(trimmed);
};

/**
 * Validates email field if provided (or required).
 * @param {string} email 
 * @param {boolean} isRequired 
 * @returns {string|null} Error message if invalid, null if valid
 */
export const validateEmailField = (email, isRequired = true) => {
  if (!email || typeof email !== 'string' || !email.trim()) {
    if (isRequired) return "Email address is required";
    return null;
  }
  if (!isValidEmail(email)) {
    return INVALID_EMAIL_MESSAGE;
  }
  return null;
};

/**
 * Official Indian GSTIN State Codes Mapping (01 to 38, 97, 99)
 */
export const GST_STATE_CODES = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction'
};

/**
 * Official Indian GSTIN Regex:
 * - 2 digits state code (01-38, 97, 99)
 * - 10 alphanumeric PAN characters (5 letters, 4 digits, 1 letter)
 * - 1 alphanumeric entity code (1-9 or A-Z)
 * - 1 letter 'Z' (fixed character by default in Indian GSTIN)
 * - 1 alphanumeric check digit (0-9 or A-Z)
 */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Official Indian PAN Regex:
 * 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)
 */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

/**
 * Validates official Indian GSTIN.
 * @param {string} gstin 
 * @returns {boolean}
 */
export const isValidGSTIN = (gstin) => {
  if (!gstin || typeof gstin !== 'string') return false;
  const clean = gstin.trim().toUpperCase();
  if (clean.length !== 15) return false;
  if (!GSTIN_REGEX.test(clean)) return false;
  const stateCode = clean.substring(0, 2);
  return Boolean(GST_STATE_CODES[stateCode]);
};

/**
 * Validates GSTIN field and returns detailed error message if invalid.
 * @param {string} gstin 
 * @param {boolean} isRequired 
 * @returns {string|null}
 */
export const validateGSTINField = (gstin, isRequired = false) => {
  if (!gstin || typeof gstin !== 'string' || !gstin.trim()) {
    if (isRequired) return "GSTIN number is required";
    return null;
  }
  const clean = gstin.trim().toUpperCase();
  if (clean.length !== 15) {
    return `GSTIN must be exactly 15 characters (currently ${clean.length}). Example: 27ABCDE1234F1Z5`;
  }
  const stateCode = clean.substring(0, 2);
  if (!GST_STATE_CODES[stateCode]) {
    return `Invalid state code '${stateCode}'. Valid GST state codes are 01 to 38 (e.g., 27 for Maharashtra, 07 for Delhi, 09 for UP).`;
  }
  if (!GSTIN_REGEX.test(clean)) {
    return "Invalid GSTIN format. Official structure: 2 State digits + 10 PAN chars + 1 Entity code + 'Z' + 1 Check digit (e.g. 27ABCDE1234F1Z5)";
  }
  return null;
};

/**
 * Extracts details from a valid GSTIN string.
 * @param {string} gstin 
 * @returns {object|null}
 */
export const parseGSTIN = (gstin) => {
  if (!gstin || typeof gstin !== 'string') return null;
  const clean = gstin.trim().toUpperCase();
  if (clean.length !== 15 || !GSTIN_REGEX.test(clean)) return null;
  const stateCode = clean.substring(0, 2);
  const stateName = GST_STATE_CODES[stateCode] || 'Unknown State';
  const pan = clean.substring(2, 12);
  const entityCode = clean.charAt(12);
  const checkDigit = clean.charAt(14);
  return {
    gstin: clean,
    stateCode,
    stateName,
    pan,
    entityCode,
    checkDigit,
    isValid: Boolean(GST_STATE_CODES[stateCode])
  };
};

/**
 * Validates official Indian PAN format.
 * @param {string} pan 
 * @param {boolean} isRequired 
 * @param {string|null} associatedGstin 
 * @returns {string|null}
 */
export const validatePANField = (pan, isRequired = false, associatedGstin = null) => {
  if (!pan || typeof pan !== 'string' || !pan.trim()) {
    if (isRequired) return "PAN number is required";
    return null;
  }
  const clean = pan.trim().toUpperCase();
  if (!PAN_REGEX.test(clean)) {
    return "Invalid PAN format. Official PAN must be 10 characters: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)";
  }
  if (associatedGstin && typeof associatedGstin === 'string' && associatedGstin.trim().length >= 12) {
    const gstinPan = associatedGstin.trim().toUpperCase().substring(2, 12);
    if (clean !== gstinPan) {
      return `PAN (${clean}) does not match the PAN inside GSTIN (${gstinPan})`;
    }
  }
  return null;
};
