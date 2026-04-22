import {
  buildSipPresetChips,
  buildSipTargetChips,
  buildReturnProfile,
  buildWealthJourneyTeaser,
  estimateRecurringMonthlySip,
  type WealthJourneyTransaction,
} from '../wealthJourney';

function tx(
  date: string,
  amount: number,
  fundId: string,
  transactionType = 'purchase',
): WealthJourneyTransaction {
  return {
    transaction_date: date,
    amount,
    fund_id: fundId,
    transaction_type: transactionType,
  };
}

describe('estimateRecurringMonthlySip', () => {
  const now = new Date('2026-04-21T00:00:00.000Z');

  it('detects recurring monthly SIPs across the last 6 months', () => {
    const transactions = [
      tx('2026-04-05', 50000, 'fund-a'),
      tx('2026-03-05', 50000, 'fund-a'),
      tx('2026-02-07', 50000, 'fund-a'),
      tx('2026-01-06', 50000, 'fund-a'),
      tx('2026-04-10', 50000, 'fund-b'),
      tx('2026-03-09', 50000, 'fund-b'),
      tx('2026-02-08', 50000, 'fund-b'),
    ];

    expect(estimateRecurringMonthlySip(transactions, now)).toBe(100000);
  });

  it('allows small day-of-month drift but ignores one-off top-ups', () => {
    const transactions = [
      tx('2026-04-05', 100000, 'fund-a'),
      tx('2026-03-08', 100000, 'fund-a'),
      tx('2026-02-06', 100000, 'fund-a'),
      tx('2026-01-05', 100000, 'fund-a'),
      tx('2026-04-17', 250000, 'fund-a'),
    ];

    expect(estimateRecurringMonthlySip(transactions, now)).toBe(100000);
  });

  it('ignores non-purchase flows and stale transactions', () => {
    const transactions = [
      tx('2026-04-05', 50000, 'fund-a'),
      tx('2026-03-05', 50000, 'fund-a'),
      tx('2026-02-05', 50000, 'fund-a'),
      tx('2025-09-05', 50000, 'fund-a'),
      tx('2026-04-05', 50000, 'fund-b', 'switch_in'),
    ];

    expect(estimateRecurringMonthlySip(transactions, now)).toBe(50000);
  });
});

describe('buildReturnProfile', () => {
  it('derives sane cautious, balanced, and growth presets from xirr', () => {
    const profile = buildReturnProfile(0.153);
    expect(profile.presets.map((preset) => preset.label)).toEqual([
      'Cautious',
      'Balanced',
      'Growth',
    ]);
    expect(profile.postRetirementDefault).toBeGreaterThanOrEqual(5);
  });
});

describe('buildSipPresetChips', () => {
  it('rounds presets to human-friendly whole amounts', () => {
    expect(buildSipPresetChips(112725)).toEqual([
      { label: '₹1.0L', value: 100000 },
      { label: '₹1.25L', value: 125000 },
      { label: '₹1.5L', value: 150000 },
    ]);
  });
});

describe('buildSipTargetChips', () => {
  it('offers stop, lower, keep, and higher targets', () => {
    expect(buildSipTargetChips(100000)).toEqual([
      { label: 'Stop', value: 0 },
      { label: '₹75K', value: 75000 },
      { label: '₹1.0L', value: 100000 },
      { label: '₹1.25L', value: 125000 },
    ]);
  });
});

describe('buildWealthJourneyTeaser', () => {
  const input = {
    currentCorpus: 80_55_000,
    monthlySip: 100000,
    annualReturn: 11.5,
  };

  it('shows a descriptive teaser for first-time users', () => {
    const teaser = buildWealthJourneyTeaser({
      ...input,
      hasOpened: false,
      hasSavedPlan: false,
      lastUsedHorizonYears: null,
    });
    expect(teaser.variant).toBe('descriptive');
    expect(teaser.cta).toBe('See possibilities');
  });

  it('shows a fixed-horizon teaser when the user has opened Wealth Journey but not saved a plan', () => {
    const teaser = buildWealthJourneyTeaser({
      ...input,
      hasOpened: true,
      hasSavedPlan: false,
      lastUsedHorizonYears: null,
    });
    expect(teaser.variant).toBe('fixed-horizon');
    expect(teaser.title).toContain('15 years');
  });

  it('shows the last used horizon once the user has a saved plan', () => {
    const teaser = buildWealthJourneyTeaser({
      ...input,
      hasOpened: true,
      hasSavedPlan: true,
      lastUsedHorizonYears: 12,
    });
    expect(teaser.variant).toBe('last-used-horizon');
    expect(teaser.title).toContain('12 years');
  });
});
