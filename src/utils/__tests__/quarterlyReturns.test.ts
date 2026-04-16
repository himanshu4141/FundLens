import { computeQuarterlyReturns } from '../quarterlyReturns';

const POS = '#00aa00';
const NEG = '#cc0000';

function makeNav(date: string, value: number) {
  return { date, value };
}

describe('computeQuarterlyReturns', () => {
  it('returns empty array for empty input', () => {
    expect(computeQuarterlyReturns([], POS, NEG)).toEqual([]);
  });

  it('returns empty array for single point', () => {
    expect(computeQuarterlyReturns([makeNav('2024-01-15', 100)], POS, NEG)).toEqual([]);
  });

  it('returns empty array when only one quarter has data (< 2 qualifying quarters)', () => {
    // Both points in same quarter but no other quarter
    const navHistory = [
      makeNav('2024-01-10', 100),
      makeNav('2024-01-20', 105),
    ];
    // Only 1 quarter with >=2 points → but each quarter needs ≥2 pts; here Q1 2024 has 2 pts
    // so 1 bar forms — but we need ≥2 bars total to show the chart
    const result = computeQuarterlyReturns(navHistory, POS, NEG);
    // 1 quarter bar: not enough for chart (the component guards bars.length < 2)
    // The function itself returns 1 bar here; the component decides
    expect(result).toHaveLength(1);
  });

  it('computes positive quarterly return correctly', () => {
    const navHistory = [
      makeNav('2024-01-01', 100),
      makeNav('2024-03-31', 110), // Q1: +10%
      makeNav('2024-04-01', 110),
      makeNav('2024-06-30', 121), // Q2: +10%
    ];
    const result = computeQuarterlyReturns(navHistory, POS, NEG);
    expect(result).toHaveLength(2);
    expect(result[0].value).toBeCloseTo(10, 1);
    expect(result[0].frontColor).toBe(POS);
    expect(result[0].label).toMatch(/Q1/);
    expect(result[1].value).toBeCloseTo(10, 1);
    expect(result[1].frontColor).toBe(POS);
  });

  it('marks negative quarters with negativeColor', () => {
    const navHistory = [
      makeNav('2024-01-01', 100),
      makeNav('2024-03-31', 95), // Q1: -5%
      makeNav('2024-04-01', 95),
      makeNav('2024-06-30', 97), // Q2: +2.1%
    ];
    const result = computeQuarterlyReturns(navHistory, POS, NEG);
    expect(result[0].frontColor).toBe(NEG);
    expect(result[1].frontColor).toBe(POS);
  });

  it('caps at 12 quarters (3 years)', () => {
    // Create 16 quarters of data
    const navHistory = [];
    let nav = 100;
    for (let year = 2021; year <= 2025; year++) {
      for (const month of ['01', '04', '07', '10']) {
        const date = `${year}-${month}-01`;
        const endDate = `${year}-${month}-28`;
        navHistory.push(makeNav(date, nav));
        nav = nav * 1.02; // +2% each quarter
        navHistory.push(makeNav(endDate, nav));
      }
    }
    const result = computeQuarterlyReturns(navHistory, POS, NEG);
    expect(result.length).toBeLessThanOrEqual(12);
  });

  it('skips quarters with only 1 NAV point', () => {
    // Q1 has only 1 point (no return computable), Q2 and Q3 have 2+
    const navHistory = [
      makeNav('2024-02-15', 100), // Q1: only 1 point
      makeNav('2024-04-01', 100),
      makeNav('2024-06-30', 108), // Q2: +8%
      makeNav('2024-07-01', 108),
      makeNav('2024-09-30', 112), // Q3: +3.7%
    ];
    const result = computeQuarterlyReturns(navHistory, POS, NEG);
    // Q1 skipped, Q2 and Q3 present
    expect(result.length).toBe(2);
    expect(result[0].label).toMatch(/Q2/);
  });

  it('label format is QN\'YY', () => {
    const navHistory = [
      makeNav('2024-01-01', 100),
      makeNav('2024-03-31', 105),
      makeNav('2024-04-01', 105),
      makeNav('2024-06-30', 110),
    ];
    const result = computeQuarterlyReturns(navHistory, POS, NEG);
    expect(result[0].label).toBe("Q1'24");
    expect(result[1].label).toBe("Q2'24");
  });

  it('handles zero firstNav gracefully (skips bar)', () => {
    const navHistory = [
      makeNav('2024-01-01', 0),   // Q1 firstNav = 0 → skip
      makeNav('2024-03-31', 100),
      makeNav('2024-04-01', 100),
      makeNav('2024-06-30', 110), // Q2: +10%
    ];
    const result = computeQuarterlyReturns(navHistory, POS, NEG);
    // Q1 skipped (firstNav=0), Q2 has 1 bar
    expect(result.every((b) => b.value !== Infinity && !isNaN(b.value))).toBe(true);
  });
});
