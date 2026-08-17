import { describe, expect, it } from 'vitest';
import { luhnValid, maskEmail, maskImei, validateImei } from './imei';

// Luhn-valid fixtures generated for the mock supplier's outcome suffixes.
const VALID = '353261110006674';
const NOT_FOUND = '353261110004000';

describe('luhnValid', () => {
  it('accepts a correct IMEI', () => {
    expect(luhnValid(VALID)).toBe(true);
  });

  it('rejects a single mistyped digit', () => {
    const corrupted = `${VALID.slice(0, 5)}${(Number(VALID[5]) + 1) % 10}${VALID.slice(6)}`;
    expect(luhnValid(corrupted)).toBe(false);
  });
});

describe('validateImei', () => {
  it('accepts a well-formed IMEI and extracts the TAC', () => {
    const result = validateImei(VALID);
    expect(result.valid).toBe(true);
    expect(result.tac).toBe('35326111');
    expect(result.normalised).toBe(VALID);
  });

  it('strips the separators people paste in', () => {
    const result = validateImei(' 35-326111 000 6674 ');
    expect(result.valid).toBe(true);
    expect(result.normalised).toBe(VALID);
  });

  it('drops the software-version suffix on an IMEISV', () => {
    const result = validateImei(`${VALID}07`);
    expect(result.valid).toBe(true);
    expect(result.normalised).toBe(VALID);
  });

  it('reports each failure distinctly so the UI can explain it', () => {
    expect(validateImei('').error).toBe('empty');
    expect(validateImei('35326111abcdefg').error).toBe('not_numeric');
    expect(validateImei('3532611100').error).toBe('wrong_length');
    expect(validateImei('353261110006675').error).toBe('bad_check_digit');
  });

  it('treats the reserved test IMEIs as valid input', () => {
    expect(validateImei(NOT_FOUND).valid).toBe(true);
  });
});

describe('masking', () => {
  it('leaves enough IMEI visible to recognise, not enough to reuse', () => {
    const masked = maskImei(VALID);
    expect(masked.startsWith('353261')).toBe(true);
    expect(masked.endsWith('6674')).toBe(true);
    expect(masked).not.toContain('1100');
  });

  it('keeps the email domain but hides the local part', () => {
    expect(maskEmail('buyer@example.com')).toMatch(/^bu•+@example\.com$/);
  });

  it('passes through a string that is not an email', () => {
    expect(maskEmail('not-an-email')).toBe('not-an-email');
  });
});
