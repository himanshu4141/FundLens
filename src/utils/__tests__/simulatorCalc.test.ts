import { projectWealth, getMilestones } from '../simulatorCalc';

describe('projectWealth', () => {
  it('zero rate — linear growth (lumpsum + sip * months)', () => {
    const pts = projectWealth(1000, 10000, 0, 3);
    expect(pts).toHaveLength(3);
    // year 1: 10000 + 1000 * 12 = 22000
    expect(pts[0]).toEqual({ year: 1, value: 22000 });
    // year 2: 10000 + 1000 * 24 = 34000
    expect(pts[1]).toEqual({ year: 2, value: 34000 });
    // year 3: 10000 + 1000 * 36 = 46000
    expect(pts[2]).toEqual({ year: 3, value: 46000 });
  });

  it('zero rate, no lumpsum — pure SIP linear growth', () => {
    const pts = projectWealth(500, 0, 0, 1);
    // year 1: 500 * 12 = 6000
    expect(pts[0].value).toBe(6000);
  });

  it('12% annual rate, lumpsum only — known compound value', () => {
    // r = 0.01/month, n = 12 months
    // FV = 100000 * (1.01)^12 = 100000 * 1.126825... ≈ 112683
    const pts = projectWealth(0, 100000, 12, 1);
    expect(pts[0].value).toBeCloseTo(112683, -2); // within ₹100
  });

  it('12% annual rate, SIP only — known compound value', () => {
    // r = 0.01/month, n = 12 months
    // FV = 1000 * ((1.01)^12 - 1) / 0.01 = 1000 * 12.6825... ≈ 12683
    const pts = projectWealth(1000, 0, 12, 1);
    expect(pts[0].value).toBeCloseTo(12683, -2);
  });

  it('horizon 1 → single point', () => {
    const pts = projectWealth(5000, 0, 12, 1);
    expect(pts).toHaveLength(1);
    expect(pts[0].year).toBe(1);
  });

  it('all-zero inputs → all zeros', () => {
    const pts = projectWealth(0, 0, 0, 5);
    expect(pts.every((p) => p.value === 0)).toBe(true);
  });

  it('negative inputs clamped to 0', () => {
    const pts = projectWealth(-1000, -5000, -12, 3);
    // behaves as projectWealth(0, 0, 0, 3) → all zeros
    expect(pts.every((p) => p.value === 0)).toBe(true);
  });

  it('returns one point per year from 1 to years', () => {
    const pts = projectWealth(5000, 0, 12, 15);
    expect(pts).toHaveLength(15);
    pts.forEach((p, i) => expect(p.year).toBe(i + 1));
  });

  it('values increase monotonically with positive inputs', () => {
    const pts = projectWealth(5000, 10000, 12, 10);
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].value).toBeGreaterThan(pts[i - 1].value);
    }
  });

  it('lumpsum + SIP combined is greater than either alone', () => {
    const combo = projectWealth(5000, 50000, 12, 10);
    const sipOnly = projectWealth(5000, 0, 12, 10);
    const lumpsumOnly = projectWealth(0, 50000, 12, 10);
    const horizon = combo[9].value;
    expect(horizon).toBeGreaterThan(sipOnly[9].value);
    expect(horizon).toBeGreaterThan(lumpsumOnly[9].value);
    // Should be roughly equal to the sum (difference is within 1 due to rounding)
    expect(horizon).toBeCloseTo(sipOnly[9].value + lumpsumOnly[9].value, -2);
  });
});

describe('getMilestones', () => {
  it('extracts years 5, 10, 15, and horizon', () => {
    const pts = projectWealth(5000, 0, 12, 20);
    const milestones = getMilestones(pts);
    const years = milestones.map((m) => m.year);
    expect(years).toEqual([5, 10, 15, 20]);
  });

  it('de-duplicates if horizon equals 15', () => {
    const pts = projectWealth(5000, 0, 12, 15);
    const milestones = getMilestones(pts);
    const years = milestones.map((m) => m.year);
    expect(years).toEqual([5, 10, 15]);
  });

  it('de-duplicates if horizon equals 10', () => {
    const pts = projectWealth(5000, 0, 12, 10);
    const milestones = getMilestones(pts);
    const years = milestones.map((m) => m.year);
    expect(years).toEqual([5, 10]);
  });

  it('horizon < 5 → only horizon shown', () => {
    const pts = projectWealth(5000, 0, 12, 3);
    const milestones = getMilestones(pts);
    expect(milestones).toHaveLength(1);
    expect(milestones[0].year).toBe(3);
  });

  it('each milestone value matches the projection point', () => {
    const pts = projectWealth(5000, 10000, 12, 15);
    const milestones = getMilestones(pts);
    for (const m of milestones) {
      const expected = pts.find((p) => p.year === m.year);
      expect(m.value).toBe(expected?.value);
    }
  });
});
