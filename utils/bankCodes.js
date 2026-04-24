/**
 * Nigerian Bank Codes for Squadco Transfer API
 * Maps bank names to their NIBSS codes
 */
export const NIGERIAN_BANK_CODES = {
  'Access Bank': '044',
  'Citibank': '023',
  'Diamond Bank': '063',
  'Ecobank': '050',
  'Fidelity Bank': '070',
  'First Bank': '011',
  'First City Monument Bank': '214',
  'Guaranty Trust Bank': '058',
  'GTB': '058',
  'Heritage Bank': '030',
  'Keystone Bank': '082',
  'Polaris Bank': '076',
  'Stanbic IBTC': '221',
  'Standard Chartered': '068',
  'Sterling Bank': '232',
  'Union Bank': '032',
  'United Bank for Africa': '033',
  'UBA': '033',
  'Unity Bank': '215',
  'Wema Bank': '035',
  'Zenith Bank': '057',
  'Opay': '999992', // Squadco code for Opay
  'Palmpay': '100033',
  'Kuda Bank': '090267',
  'Moniepoint': '090405',
  'Carbon': '100026',
};

/**
 * Get bank code from bank name
 * Performs fuzzy matching to handle variations
 */
export function getBankCode(bankName) {
  if (!bankName) return null;

  const normalized = bankName.trim().toLowerCase();

  // Exact match first
  for (const [name, code] of Object.entries(NIGERIAN_BANK_CODES)) {
    if (name.toLowerCase() === normalized) {
      return code;
    }
  }

  // Fuzzy match
  for (const [name, code] of Object.entries(NIGERIAN_BANK_CODES)) {
    if (name.toLowerCase().includes(normalized) || normalized.includes(name.toLowerCase())) {
      return code;
    }
  }

  return null;
}

/**
 * Validate bank name and return code
 * Throws error if bank not found
 */
export function validateAndGetBankCode(bankName) {
  const code = getBankCode(bankName);
  if (!code) {
    throw new Error(`Bank not recognized: "${bankName}". Please contact the organizer to resubmit with a valid bank name.`);
  }
  return code;
}
