/**
 * IMEI handling.
 *
 * An IMEI is 15 digits: an 8-digit TAC (Type Allocation Code) identifying the
 * model, a 6-digit serial, and a Luhn check digit. Validating locally means we
 * reject typos before spending a supplier lookup on them, and the TAC lets us
 * name the handset back to the customer so they can confirm before paying.
 */

export type ImeiError =
  | 'empty'
  | 'not_numeric'
  | 'wrong_length'
  | 'bad_check_digit';

export interface ImeiValidation {
  valid: boolean;
  error?: ImeiError;
  /** Digits only, with any spaces, dashes or a trailing SV suffix removed. */
  normalised: string;
  tac?: string;
}

export const IMEI_ERROR_MESSAGES: Record<ImeiError, string> = {
  empty: 'Enter the IMEI of the phone you want to unlock.',
  not_numeric: 'An IMEI contains digits only — dial *#06# to see yours.',
  wrong_length: 'An IMEI is exactly 15 digits long.',
  bad_check_digit:
    "That IMEI failed its checksum, so a digit is probably mistyped. Dial *#06# and re-enter it.",
};

/**
 * Luhn checksum over the full 15 digits, where the check digit is the last one.
 * Doubling from the second-to-last digit leftwards makes the parity depend on
 * length, so this walks right-to-left rather than assuming fixed positions.
 */
export function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function validateImei(input: string): ImeiValidation {
  const raw = (input ?? '').trim();
  if (raw.length === 0) return { valid: false, error: 'empty', normalised: '' };

  // Strip the separators people paste in from *#06# output.
  const stripped = raw.replace(/[\s\-./]/g, '');

  // A 16- or 17-digit IMEISV carries a 1-2 digit software version we discard.
  const candidate =
    /^\d{16,17}$/.test(stripped) ? stripped.slice(0, 15) : stripped;

  if (!/^\d+$/.test(candidate)) {
    return { valid: false, error: 'not_numeric', normalised: candidate };
  }
  if (candidate.length !== 15) {
    return { valid: false, error: 'wrong_length', normalised: candidate };
  }
  if (!luhnValid(candidate)) {
    return { valid: false, error: 'bad_check_digit', normalised: candidate };
  }
  return { valid: true, normalised: candidate, tac: candidate.slice(0, 8) };
}

/**
 * Show enough of the IMEI for the customer to recognise their own order
 * without printing the whole identifier on a page reachable by reference.
 */
export function maskImei(imei: string): string {
  if (imei.length < 15) return imei;
  return `${imei.slice(0, 6)}${'•'.repeat(5)}${imei.slice(11)}`;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const head = user.slice(0, Math.min(2, user.length));
  return `${head}${'•'.repeat(Math.max(3, user.length - head.length))}@${domain}`;
}
