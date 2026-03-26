import { parseFundName } from '@/src/utils/fundName';

describe('parseFundName()', () => {
  // ── Standard patterns ────────────────────────────────────────────────────
  test('splits Direct Plan Growth into base + badge', () => {
    const { base, planBadge } = parseFundName('HDFC Flexi Cap Fund - Direct Plan - Growth');
    expect(base).toBe('HDFC Flexi Cap Fund');
    expect(planBadge).toBe('Direct · Growth');
  });

  test('splits Regular Plan Growth into base + badge', () => {
    const { base, planBadge } = parseFundName('Axis Long Term Equity Fund - Regular Plan - Growth');
    expect(base).toBe('Axis Long Term Equity Fund');
    expect(planBadge).toBe('Regular · Growth');
  });

  test('splits Direct Plan IDCW into base + badge', () => {
    const { base, planBadge } = parseFundName('SBI Blue Chip Fund - Direct Plan - IDCW');
    expect(base).toBe('SBI Blue Chip Fund');
    expect(planBadge).toBe('Direct · Idcw');
  });

  test('splits Regular Plan IDCW into base + badge', () => {
    const { base, planBadge } = parseFundName('Mirae Asset Large Cap Fund - Regular Plan - IDCW');
    expect(base).toBe('Mirae Asset Large Cap Fund');
    expect(planBadge).toBe('Regular · Idcw');
  });

  // ── IDCW with extra words (e.g. "IDCW Reinvestment") ────────────────────
  test('uses only the first word of the option for IDCW variants', () => {
    const { base, planBadge } = parseFundName('Franklin India Bluechip Fund - Direct Plan - IDCW Reinvestment');
    expect(base).toBe('Franklin India Bluechip Fund');
    expect(planBadge).toBe('Direct · Idcw');
  });

  // ── Case insensitivity ───────────────────────────────────────────────────
  test('is case-insensitive for plan and option keywords', () => {
    const { base, planBadge } = parseFundName('DSP Midcap Fund - direct plan - growth');
    expect(base).toBe('DSP Midcap Fund');
    expect(planBadge).toBe('Direct · Growth');
  });

  // ── Unrecognised / non-standard formats → graceful fallback ─────────────
  test('returns full name as base with null badge for unrecognised format', () => {
    const name = 'Some Unusual Fund Name';
    const { base, planBadge } = parseFundName(name);
    expect(base).toBe(name);
    expect(planBadge).toBeNull();
  });

  test('returns full name as base with null badge for empty string', () => {
    const { base, planBadge } = parseFundName('');
    expect(base).toBe('');
    expect(planBadge).toBeNull();
  });

  test('handles fund names that contain hyphens in the base name', () => {
    // "Nippon India - ETF Nifty 50" style names (no Plan suffix)
    const name = 'Nippon India ETF Nifty 50 BeES';
    const { base, planBadge } = parseFundName(name);
    expect(base).toBe(name);
    expect(planBadge).toBeNull();
  });

  // ── Differentiation: all 4 combinations must produce distinct badges ────
  test('all four plan/option combinations produce distinct planBadge values', () => {
    const combinations = [
      'Fund A - Direct Plan - Growth',
      'Fund A - Direct Plan - IDCW',
      'Fund A - Regular Plan - Growth',
      'Fund A - Regular Plan - IDCW',
    ];
    const badges = combinations.map((n) => parseFundName(n).planBadge);
    const unique = new Set(badges);
    expect(unique.size).toBe(4);
  });
});
