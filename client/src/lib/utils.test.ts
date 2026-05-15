import { describe, it, expect } from 'vitest';
import { formatCurrency } from './utils';

describe('formatCurrency', () => {
  it('formats a plain integer to 2 decimal places', () => {
    expect(formatCurrency(25)).toBe('25.00');
  });

  it('formats a decimal that would otherwise show floating-point noise', () => {
    const sum = 59.6 + 119.2;
    expect(formatCurrency(sum)).toBe('178.80');
  });

  it('formats a numeric string', () => {
    expect(formatCurrency('25.5')).toBe('25.50');
  });

  it('returns 0.00 for null', () => {
    expect(formatCurrency(null)).toBe('0.00');
  });

  it('returns 0.00 for undefined', () => {
    expect(formatCurrency(undefined)).toBe('0.00');
  });

  it('returns 0.00 for NaN', () => {
    expect(formatCurrency(NaN)).toBe('0.00');
  });

  it('returns 0.00 for non-numeric strings', () => {
    expect(formatCurrency('N/A')).toBe('0.00');
  });

  it('formats large numbers with thousands separators', () => {
    expect(formatCurrency(1234.56)).toBe('1,234.56');
  });
});
