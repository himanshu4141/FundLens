import { projectWealth } from '@/src/utils/simulatorCalc';

export interface WealthJourneyTransaction {
  transaction_date: string;
  amount: number;
  transaction_type: string;
  fund_id: string | null;
}

export type ReturnPresetKey = 'cautious' | 'balanced' | 'growth' | 'custom';

export interface ReturnPreset {
  key: Exclude<ReturnPresetKey, 'custom'>;
  label: string;
  value: number;
}

export interface ReturnProfile {
  suggestedLabel: string;
  defaultPresetKey: Exclude<ReturnPresetKey, 'custom'>;
  presets: ReturnPreset[];
  postRetirementDefault: number;
}

export interface WealthJourneyTeaser {
  variant: 'descriptive' | 'fixed-horizon' | 'last-used-horizon';
  eyebrow: string;
  title: string;
  supportingText: string;
  cta: 'See possibilities';
}

export interface WealthJourneyTeaserInput {
  hasOpened: boolean;
  hasSavedPlan: boolean;
  currentCorpus: number;
  monthlySip: number;
  annualReturn: number;
  lastUsedHorizonYears: number | null;
}

const CTA_LABEL = 'See possibilities' as const;
const ONE_MONTH_MS = 1000 * 60 * 60 * 24 * 31;

function getRecentCutoff(maxMonths: number): Date {
  const now = new Date();
  return new Date(now.getTime() - maxMonths * ONE_MONTH_MS);
}

function getAmountBucket(amount: number): number {
  if (amount >= 100_000) return Math.round(amount / 1000) * 1000;
  if (amount >= 25_000) return Math.round(amount / 500) * 500;
  return Math.round(amount / 100) * 100;
}

function roundToHumanAmount(value: number, step = 25_000): number {
  return Math.round(value / step) * step;
}

function getMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function estimateRecurringMonthlySip(
  transactions: WealthJourneyTransaction[],
  now = new Date(),
): number {
  const cutoff = getRecentCutoff(6);
  const recurringGroups = new Map<
    string,
    {
      fundId: string;
      amountBucket: number;
      latestDate: number;
      months: Set<string>;
    }
  >();

  for (const transaction of transactions) {
    if (transaction.transaction_type !== 'purchase') continue;
    if (!transaction.fund_id) continue;
    if (!Number.isFinite(transaction.amount) || transaction.amount <= 0) continue;

    const transactionDate = new Date(transaction.transaction_date);
    if (Number.isNaN(transactionDate.getTime())) continue;
    if (transactionDate < cutoff || transactionDate > now) continue;

    const amountBucket = getAmountBucket(transaction.amount);
    const dayBucket = Math.round(transactionDate.getUTCDate() / 3) * 3;
    const key = `${transaction.fund_id}|${amountBucket}|${dayBucket}`;
    const existing = recurringGroups.get(key);

    if (existing) {
      existing.months.add(getMonthKey(transactionDate));
      existing.latestDate = Math.max(existing.latestDate, transactionDate.getTime());
      continue;
    }

    recurringGroups.set(key, {
      fundId: transaction.fund_id,
      amountBucket,
      latestDate: transactionDate.getTime(),
      months: new Set([getMonthKey(transactionDate)]),
    });
  }

  const bestByFund = new Map<
    string,
    { amountBucket: number; monthCount: number; latestDate: number }
  >();

  for (const group of recurringGroups.values()) {
    if (group.months.size < 3) continue;
    const previous = bestByFund.get(group.fundId);
    if (
      !previous ||
      group.months.size > previous.monthCount ||
      (group.months.size === previous.monthCount && group.latestDate > previous.latestDate)
    ) {
      bestByFund.set(group.fundId, {
        amountBucket: group.amountBucket,
        monthCount: group.months.size,
        latestDate: group.latestDate,
      });
    }
  }

  return [...bestByFund.values()].reduce((sum, group) => sum + group.amountBucket, 0);
}

function clampReturnPercent(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.min(14, Math.max(8, value));
}

export function buildReturnProfile(xirr: number | null | undefined): ReturnProfile {
  const rawXirrPercent =
    Number.isFinite(xirr) && xirr != null && xirr > 0 ? xirr * 100 : 10;
  const balanced = Number(clampReturnPercent(rawXirrPercent).toFixed(1));
  const cautious = Number(Math.max(6, balanced - 2).toFixed(1));
  const growth = Number(Math.min(16, balanced + 1.5).toFixed(1));

  let defaultPresetKey: ReturnProfile['defaultPresetKey'] = 'balanced';
  if (balanced <= 9) defaultPresetKey = 'cautious';
  if (balanced >= 12.5) defaultPresetKey = 'growth';

  return {
    suggestedLabel:
      defaultPresetKey === 'cautious'
        ? 'Cautious'
        : defaultPresetKey === 'growth'
          ? 'Growth'
          : 'Balanced',
    defaultPresetKey,
    presets: [
      { key: 'cautious', label: 'Cautious', value: cautious },
      { key: 'balanced', label: 'Balanced', value: balanced },
      { key: 'growth', label: 'Growth', value: growth },
    ],
    postRetirementDefault: Number(Math.max(5, balanced - 3).toFixed(1)),
  };
}

export function buildSipPresetChips(baseValue: number): { label: string; value: number }[] {
  const roundedBase = roundToHumanAmount(Math.max(baseValue, 50_000));
  const lower = roundToHumanAmount(Math.max(25_000, roundedBase - 25_000));
  const upper = roundToHumanAmount(roundedBase + 25_000);
  return [
    { label: formatSipPresetLabel(lower), value: lower },
    { label: formatSipPresetLabel(roundedBase), value: roundedBase },
    { label: formatSipPresetLabel(upper), value: upper },
  ];
}

function buildProjectedCorpusText(
  currentCorpus: number,
  monthlySip: number,
  annualReturn: number,
  years: number,
): string {
  const projected = projectWealth(monthlySip, currentCorpus, annualReturn, years)[years - 1]?.value ?? 0;
  return `At your current plan, this could grow to ₹${formatCompactNumber(projected)} in ${years} years`;
}

function formatCompactNumber(value: number): string {
  if (value >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(1)}Cr`;
  if (value >= 1_00_000) return `${(value / 1_00_000).toFixed(1)}L`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toString();
}

function formatSipPresetLabel(value: number): string {
  if (value >= 1_00_000) {
    const lakhs = value / 1_00_000;
    return `₹${lakhs.toFixed(2).replace(/(\.\d)0$/, '$1')}L`;
  }

  if (value >= 1_000) {
    return `₹${Math.round(value / 1_000)}K`;
  }

  return `₹${Math.round(value)}`;
}

export function buildWealthJourneyTeaser({
  hasOpened,
  hasSavedPlan,
  currentCorpus,
  monthlySip,
  annualReturn,
  lastUsedHorizonYears,
}: WealthJourneyTeaserInput): WealthJourneyTeaser {
  if (!hasOpened) {
    return {
      variant: 'descriptive',
      eyebrow: 'Wealth Journey',
      title: 'See how your current corpus, SIP, and top-ups could change your future wealth.',
      supportingText: 'Start with your portfolio today, then explore different paths.',
      cta: CTA_LABEL,
    };
  }

  if (hasSavedPlan && lastUsedHorizonYears) {
    return {
      variant: 'last-used-horizon',
      eyebrow: 'Wealth Journey',
      title: buildProjectedCorpusText(
        currentCorpus,
        monthlySip,
        annualReturn,
        lastUsedHorizonYears,
      ),
      supportingText: 'Based on your last-used Wealth Journey horizon.',
      cta: CTA_LABEL,
    };
  }

  return {
    variant: 'fixed-horizon',
    eyebrow: 'Wealth Journey',
    title: buildProjectedCorpusText(currentCorpus, monthlySip, annualReturn, 15),
    supportingText: 'Based on your current corpus and monthly investment.',
    cta: CTA_LABEL,
  };
}
