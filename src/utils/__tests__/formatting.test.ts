import { formatCurrency, formatChange } from '../formatting';

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------

describe('formatCurrency', () => {
  describe('below ₹1,000 — plain rupees', () => {
    it('formats zero', () => expect(formatCurrency(0)).toBe('₹0'));
    it('formats a typical small amount', () => expect(formatCurrency(500)).toBe('₹500'));
    it('formats 999 (just below K boundary)', () => expect(formatCurrency(999)).toBe('₹999'));
    it('formats 1 rupee', () => expect(formatCurrency(1)).toBe('₹1'));
    it('formats decimal amounts (rounds)', () => expect(formatCurrency(99.9)).toBe('₹100'));
  });

  describe('₹1,000 – ₹99,999 — K notation', () => {
    it('formats exact 1K boundary', () => expect(formatCurrency(1000)).toBe('₹1.0K'));
    it('formats a mid-K value', () => expect(formatCurrency(5000)).toBe('₹5.0K'));
    it('formats 12,500', () => expect(formatCurrency(12500)).toBe('₹12.5K'));
    it('formats 50,000', () => expect(formatCurrency(50000)).toBe('₹50.0K'));
    it('formats 99,999 (just below 1L boundary)', () =>
      expect(formatCurrency(99999)).toBe('₹100.0K'));
  });

  describe('₹1,00,000 – ₹99,99,999 — L (lakh) notation', () => {
    it('formats exact 1L boundary', () => expect(formatCurrency(100000)).toBe('₹1.00L'));
    it('formats 1.5L', () => expect(formatCurrency(150000)).toBe('₹1.50L'));
    it('formats 10L', () => expect(formatCurrency(1000000)).toBe('₹10.00L'));
    it('formats 25.75L', () => expect(formatCurrency(2575000)).toBe('₹25.75L'));
    it('keeps two decimal places', () => expect(formatCurrency(123456)).toBe('₹1.23L'));
  });

  describe('≥ ₹1,00,00,000 — Cr (crore) notation', () => {
    it('formats exact 1Cr boundary', () => expect(formatCurrency(10000000)).toBe('₹1.00Cr'));
    it('formats 5.5 Cr', () => expect(formatCurrency(55000000)).toBe('₹5.50Cr'));
    it('formats 100 Cr', () => expect(formatCurrency(1000000000)).toBe('₹100.00Cr'));
    it('keeps two decimal places for crore', () => expect(formatCurrency(12345678)).toBe('₹1.23Cr'));
  });
});

// ---------------------------------------------------------------------------
// formatChange
// ---------------------------------------------------------------------------

describe('formatChange', () => {
  it('positive amount shows + prefix on both parts', () => {
    expect(formatChange(5000, 2.5)).toBe('+₹5.0K (+2.50%)');
  });

  it('negative amount shows no + prefix, minus from pct', () => {
    expect(formatChange(-5000, -2.5)).toBe('₹5.0K (-2.50%)');
  });

  it('zero change shows + prefix with 0.00%', () => {
    expect(formatChange(0, 0)).toBe('+₹0 (+0.00%)');
  });

  it('large positive change uses Cr notation', () => {
    expect(formatChange(10000000, 15.75)).toBe('+₹1.00Cr (+15.75%)');
  });

  it('small negative change stays in plain rupees', () => {
    expect(formatChange(-50, -0.05)).toBe('₹50 (-0.05%)');
  });

  it('pct precision is always 2 decimal places', () => {
    expect(formatChange(1000, 1.1234)).toBe('+₹1.0K (+1.12%)');
  });

  it('fractional negative pct', () => {
    expect(formatChange(-1000, -0.333)).toBe('₹1.0K (-0.33%)');
  });
});
