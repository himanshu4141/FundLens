import { formatCurrency, formatChange } from './formatting';

// ─── formatCurrency ───────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  describe('zero and small values (< ₹1K)', () => {
    test('zero → ₹0', () => {
      expect(formatCurrency(0)).toBe('₹0');
    });

    test('single rupee', () => {
      expect(formatCurrency(1)).toBe('₹1');
    });

    test('fractional rupee rounds down', () => {
      expect(formatCurrency(0.01)).toBe('₹0');
    });

    test('just below ₹1K threshold', () => {
      expect(formatCurrency(999)).toBe('₹999');
    });

    test('negative value below ₹1K', () => {
      // formatCurrency doesn't handle negatives specially — shows negative rupees
      expect(formatCurrency(-500)).toBe('₹-500');
    });
  });

  describe('thousands (₹1K – ₹99.9K)', () => {
    test('exactly ₹1,000 → ₹1.0K', () => {
      expect(formatCurrency(1_000)).toBe('₹1.0K');
    });

    test('₹1,500 → ₹1.5K', () => {
      expect(formatCurrency(1_500)).toBe('₹1.5K');
    });

    test('₹10,000 → ₹10.0K', () => {
      expect(formatCurrency(10_000)).toBe('₹10.0K');
    });

    test('₹56 (no K) — exact friend test case', () => {
      expect(formatCurrency(56)).toBe('₹56');
    });

    test('₹22,500 (fund invested amount) → ₹22.5K', () => {
      expect(formatCurrency(22_500)).toBe('₹22.5K');
    });

    test('just below ₹1L threshold (₹99,999)', () => {
      expect(formatCurrency(99_999)).toBe('₹100.0K');
    });
  });

  describe('lakhs (₹1L – ₹99.9L)', () => {
    test('exactly ₹1,00,000 → ₹1.00L', () => {
      expect(formatCurrency(1_00_000)).toBe('₹1.00L');
    });

    test('₹2,50,000 → ₹2.50L', () => {
      expect(formatCurrency(2_50_000)).toBe('₹2.50L');
    });

    test('₹10,00,000 → ₹10.00L', () => {
      expect(formatCurrency(10_00_000)).toBe('₹10.00L');
    });

    test('just below ₹1Cr threshold (₹99,99,999)', () => {
      expect(formatCurrency(99_99_999)).toBe('₹100.00L');
    });
  });

  describe('crores (₹1Cr+)', () => {
    test('exactly ₹1 crore → ₹1.00Cr', () => {
      expect(formatCurrency(1_00_00_000)).toBe('₹1.00Cr');
    });

    test('₹5.5 crore', () => {
      expect(formatCurrency(5_50_00_000)).toBe('₹5.50Cr');
    });

    test('₹10 crore (very large)', () => {
      expect(formatCurrency(10_00_00_000)).toBe('₹10.00Cr');
    });

    test('₹100 crore', () => {
      expect(formatCurrency(100_00_00_000)).toBe('₹100.00Cr');
    });
  });
});

// ─── formatChange ─────────────────────────────────────────────────────────────

describe('formatChange', () => {
  test('positive amount + positive pct shows + prefix', () => {
    expect(formatChange(1500, 3.5)).toBe('+₹1.5K (+3.50%)');
  });

  test('negative amount + negative pct shows no double-sign', () => {
    // amount is negative, sign derived from amount
    expect(formatChange(-500, -2.5)).toBe('-₹500 (-2.50%)');
  });

  test('zero amount and zero pct', () => {
    expect(formatChange(0, 0)).toBe('+₹0 (+0.00%)');
  });

  test('large positive daily change', () => {
    expect(formatChange(25_000, 1.25)).toBe('+₹25.0K (+1.25%)');
  });

  test('small negative daily change (< ₹1K)', () => {
    expect(formatChange(-200, -0.18)).toBe('-₹200 (-0.18%)');
  });

  test('pct precision is always 2 decimal places', () => {
    const result = formatChange(100, 1.1);
    expect(result).toMatch(/1\.10%/);
  });

  test('amount in crores', () => {
    expect(formatChange(2_50_00_000, 5.0)).toBe('+₹2.50Cr (+5.00%)');
  });
});
