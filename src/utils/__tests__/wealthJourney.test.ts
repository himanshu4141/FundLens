import {
  buildSipPresetChips,
  buildSipTargetChips,
  buildReturnProfile,
  buildWealthJourneyTeaser,
  detectRecurringMonthlySipDetails,
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
    expect(detectRecurringMonthlySipDetails(transactions, now)).toEqual([
      { fundId: 'fund-b', amount: 50000, monthCount: 3, latestDate: '2026-04-10' },
      { fundId: 'fund-a', amount: 50000, monthCount: 4, latestDate: '2026-04-05' },
    ]);
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

  it('ignores malformed and future transactions', () => {
    const transactions: WealthJourneyTransaction[] = [
      tx('2026-04-05', 1200, 'fund-a'),
      tx('2026-03-05', 1200, 'fund-a'),
      tx('2026-02-05', 1200, 'fund-a'),
      tx('2026-04-05', Number.NaN, 'fund-b'),
      tx('2026-04-05', -500, 'fund-b'),
      tx('not-a-date', 1200, 'fund-b'),
      tx('2026-05-05', 1200, 'fund-b'),
      { ...tx('2026-04-05', 1200, 'fund-c'), fund_id: null },
    ];

    expect(detectRecurringMonthlySipDetails(transactions, now)).toEqual([
      { fundId: 'fund-a', amount: 1200, monthCount: 3, latestDate: '2026-04-05' },
    ]);
  });

  it('keeps the stronger recurring pattern per fund', () => {
    const transactions = [
      tx('2026-04-05', 50000, 'fund-a'),
      tx('2026-03-05', 50000, 'fund-a'),
      tx('2026-02-05', 50000, 'fund-a'),
      tx('2026-04-10', 75000, 'fund-a'),
      tx('2026-03-10', 75000, 'fund-a'),
      tx('2026-02-10', 75000, 'fund-a'),
      tx('2026-01-10', 75000, 'fund-a'),
    ];

    expect(detectRecurringMonthlySipDetails(transactions, now)).toEqual([
      { fundId: 'fund-a', amount: 75000, monthCount: 4, latestDate: '2026-04-10' },
    ]);
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

  it('uses the default return assumptions for absent or invalid xirr', () => {
    expect(buildReturnProfile(null).defaultPresetKey).toBe('growth');
    expect(buildReturnProfile(Number.NaN).suggestedLabel).toBe('Growth');
  });

  it('suggests cautious and growth profiles near the preset edges', () => {
    expect(buildReturnProfile(0.07).suggestedLabel).toBe('Cautious');
    expect(buildReturnProfile(0.14).suggestedLabel).toBe('Growth');
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

  it('uses the minimum preset range for small base values', () => {
    expect(buildSipPresetChips(5000)).toEqual([
      { label: '₹25K', value: 25000 },
      { label: '₹50K', value: 50000 },
      { label: '₹75K', value: 75000 },
    ]);
  });
});

describe('buildSipTargetChips', () => {
  it('offers no SIP, lower, keep, and higher targets', () => {
    expect(buildSipTargetChips(100000)).toEqual([
      { label: 'No SIP', value: 0 },
      { label: '₹75K', value: 75000 },
      { label: '₹1.0L', value: 100000 },
      { label: '₹1.25L', value: 125000 },
    ]);
  });

  it('deduplicates zero and lower targets for small SIPs', () => {
    expect(buildSipTargetChips(100)).toEqual([
      { label: 'No SIP', value: 0 },
      { label: '₹25K', value: 25000 },
      { label: '₹50K', value: 50000 },
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

  it('falls back to fixed horizon when a saved plan has no last-used horizon', () => {
    const teaser = buildWealthJourneyTeaser({
      ...input,
      hasOpened: true,
      hasSavedPlan: true,
      lastUsedHorizonYears: null,
    });

    expect(teaser.variant).toBe('fixed-horizon');
  });

  it('formats projected corpus in compact lakh, thousand, and raw values', () => {
    const lakhTeaser = buildWealthJourneyTeaser({
      hasOpened: true,
      hasSavedPlan: true,
      currentCorpus: 2_00_000,
      monthlySip: 0,
      annualReturn: 0,
      lastUsedHorizonYears: 1,
    });
    const thousandTeaser = buildWealthJourneyTeaser({
      hasOpened: true,
      hasSavedPlan: true,
      currentCorpus: 5_000,
      monthlySip: 0,
      annualReturn: 0,
      lastUsedHorizonYears: 1,
    });
    const rawTeaser = buildWealthJourneyTeaser({
      hasOpened: true,
      hasSavedPlan: true,
      currentCorpus: 500,
      monthlySip: 0,
      annualReturn: 0,
      lastUsedHorizonYears: 1,
    });

    expect(lakhTeaser.title).toContain('₹2.0L');
    expect(thousandTeaser.title).toContain('₹5.0K');
    expect(rawTeaser.title).toContain('₹500');
  });
});
