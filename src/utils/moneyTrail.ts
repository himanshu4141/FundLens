export type MoneyTrailTransactionType =
  | 'sip_purchase'
  | 'purchase'
  | 'redemption'
  | 'switch_in'
  | 'switch_out'
  | 'dividend_payout'
  | 'dividend_reinvestment'
  | 'stp_in'
  | 'stp_out'
  | 'swp'
  | 'transfer'
  | 'reversal'
  | 'failed'
  | 'unknown';

export type MoneyTrailDirection = 'money_in' | 'money_out' | 'internal' | 'neutral';
export type MoneyTrailStatus = 'success' | 'failed' | 'reversed' | 'hidden';
export type MoneyTrailSortOption =
  | 'newest'
  | 'oldest'
  | 'amount_desc'
  | 'amount_asc'
  | 'fund_asc'
  | 'fund_desc';
export type MoneyTrailDatePreset = 'this_fy' | 'last_fy' | 'last_3_months' | 'all_time' | 'custom';

export interface RawMoneyTrailTransaction {
  id: string;
  fund_id: string;
  fund_name?: string | null;
  scheme_name?: string | null;
  scheme_category?: string | null;
  amc_name?: string | null;
  transaction_date: string;
  transaction_type: string;
  units: number | null;
  amount: number | null;
  nav_at_transaction?: number | null;
  folio_number?: string | null;
  reference_id?: string | null;
  payment_mode?: string | null;
  installment_number?: string | number | null;
  cas_import_id?: string | null;
  created_at?: string | null;
  status?: string | null;
}

export interface PortfolioTransaction {
  id: string;
  date: string;
  financialYear: string;
  fundId: string;
  fundName: string;
  amcId?: string;
  amcName?: string;
  type: MoneyTrailTransactionType;
  rawType: string;
  userFacingType: string;
  direction: MoneyTrailDirection;
  amount: number;
  units?: number;
  nav?: number;
  folioNumber?: string;
  referenceId?: string;
  paymentMode?: string;
  installmentNumber?: string;
  status: MoneyTrailStatus;
  source: 'cas';
  includedInInvestedAmount: boolean;
  includedInXirr: boolean;
  includedInCurrentHoldings: boolean;
  hiddenByDefault: boolean;
  hiddenReason?: string;
}

export interface AnnualMoneyFlow {
  financialYear: string;
  invested: number;
  withdrawn: number;
  netInvested: number;
  transactionCount: number;
}

export interface MoneyTrailSummary {
  totalInvested: number;
  totalWithdrawn: number;
  netInvested: number;
  transactionCount: number;
}

export interface MoneyTrailFilters {
  datePreset: MoneyTrailDatePreset;
  transactionTypes: MoneyTrailTransactionType[];
  directions: MoneyTrailDirection[];
  amcNames: string[];
  fundIds: string[];
  minAmount?: number;
  maxAmount?: number;
  customStartDate?: string;
  customEndDate?: string;
  includeHidden: boolean;
}

export const DEFAULT_MONEY_TRAIL_FILTERS: MoneyTrailFilters = {
  datePreset: 'all_time',
  transactionTypes: [],
  directions: [],
  amcNames: [],
  fundIds: [],
  includeHidden: false,
};

export const MONEY_TRAIL_SORT_LABELS: Record<MoneyTrailSortOption, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  amount_desc: 'Amount - high to low',
  amount_asc: 'Amount - low to high',
  fund_asc: 'Fund name - A to Z',
  fund_desc: 'Fund name - Z to A',
};

export function getIndianFinancialYear(dateIso: string): string {
  const date = parseIsoDate(dateIso);
  if (!date) return 'Unknown FY';
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const startYear = month >= 3 ? year : year - 1;
  const endYearShort = String(startYear + 1).slice(-2);
  return `FY ${startYear}-${endYearShort}`;
}

export function getFinancialYearShortLabel(financialYear: string): string {
  const match = financialYear.match(/^FY\s+(\d{4})-(\d{2})$/);
  if (!match) return financialYear;
  return `FY${match[2]}`;
}

export function getCurrentFinancialYear(now = new Date()): string {
  return getIndianFinancialYear(now.toISOString().slice(0, 10));
}

export function normalizeMoneyTrailType(rawType: string): MoneyTrailTransactionType {
  const normalized = rawType.trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (['purchase_sip', 'sip_purchase', 'sip', 'systematic_investment_plan'].includes(normalized)) {
    return 'sip_purchase';
  }
  if (['purchase', 'buy', 'lumpsum', 'lump_sum', 'fresh_purchase'].includes(normalized)) {
    return 'purchase';
  }
  if (['redemption', 'redeem', 'withdrawal'].includes(normalized)) return 'redemption';
  if (['switch_in', 'switch_in_merger'].includes(normalized)) return 'switch_in';
  if (['switch_out', 'switch_out_merger'].includes(normalized)) return 'switch_out';
  if (['dividend', 'dividend_payout', 'dividend_paid', 'payout'].includes(normalized)) {
    return 'dividend_payout';
  }
  if (['dividend_reinvest', 'dividend_reinvestment', 'dividend_reinvested'].includes(normalized)) {
    return 'dividend_reinvestment';
  }
  if (['stp_in'].includes(normalized)) return 'stp_in';
  if (['stp_out'].includes(normalized)) return 'stp_out';
  if (['swp', 'systematic_withdrawal'].includes(normalized)) return 'swp';
  if (['transfer', 'transferred', 'transfer_in', 'transfer_out'].includes(normalized)) return 'transfer';
  if (['reversal', 'reversed', 'cancelled', 'canceled'].includes(normalized)) return 'reversal';
  if (['failed', 'failure', 'rejected'].includes(normalized)) return 'failed';

  return 'unknown';
}

export function mapMoneyTrailType(type: MoneyTrailTransactionType): {
  userFacingType: string;
  direction: MoneyTrailDirection;
  status: MoneyTrailStatus;
  includedInInvestedAmount: boolean;
  includedInXirr: boolean;
  includedInCurrentHoldings: boolean;
  hiddenByDefault: boolean;
  hiddenReason?: string;
} {
  switch (type) {
    case 'sip_purchase':
      return baseMapping('SIP investment', 'money_in', true, true, true);
    case 'purchase':
      return baseMapping('Investment', 'money_in', true, true, true);
    case 'redemption':
      return baseMapping('Withdrawal', 'money_out', false, true, true);
    case 'switch_in':
      return baseMapping('Switch in', 'internal', false, true, true);
    case 'switch_out':
      return baseMapping('Switch out', 'internal', false, true, true);
    case 'dividend_payout':
      return baseMapping('Dividend received', 'money_out', false, false, false);
    case 'dividend_reinvestment':
      return baseMapping('Dividend reinvested', 'internal', false, true, true);
    case 'stp_in':
      return baseMapping('Transfer in', 'internal', false, false, true);
    case 'stp_out':
      return baseMapping('Transfer out', 'internal', false, false, true);
    case 'swp':
      return baseMapping('Withdrawal', 'money_out', false, false, true);
    case 'transfer':
      return baseMapping('Transfer', 'internal', false, false, true);
    case 'reversal':
      return {
        ...baseMapping('Reversal', 'neutral', false, false, false),
        status: 'reversed',
        hiddenByDefault: true,
        hiddenReason: 'Reversed transaction',
      };
    case 'failed':
      return {
        ...baseMapping('Failed', 'neutral', false, false, false),
        status: 'failed',
        hiddenByDefault: true,
        hiddenReason: 'Failed transaction',
      };
    case 'unknown':
    default:
      return baseMapping('Other movement', 'neutral', false, false, false);
  }
}

function baseMapping(
  userFacingType: string,
  direction: MoneyTrailDirection,
  includedInInvestedAmount: boolean,
  includedInXirr: boolean,
  includedInCurrentHoldings: boolean,
) {
  return {
    userFacingType,
    direction,
    status: 'success' as const,
    includedInInvestedAmount,
    includedInXirr,
    includedInCurrentHoldings,
    hiddenByDefault: false,
  };
}

export function buildPortfolioTransaction(raw: RawMoneyTrailTransaction): PortfolioTransaction {
  const type = normalizeMoneyTrailType(raw.transaction_type);
  const mapping = mapMoneyTrailType(type);
  const status = normalizeStatus(raw.status) ?? mapping.status;
  const hiddenByDefault = mapping.hiddenByDefault || status === 'failed' || status === 'reversed';
  const fundName = raw.fund_name ?? raw.scheme_name ?? 'Unknown fund';
  const amount = Math.abs(Number(raw.amount ?? 0));
  const units = finiteOrUndefined(raw.units);
  const nav = finiteOrUndefined(raw.nav_at_transaction);
  const referenceId = raw.reference_id ?? raw.cas_import_id ?? undefined;

  return {
    id: raw.id,
    date: raw.transaction_date,
    financialYear: getIndianFinancialYear(raw.transaction_date),
    fundId: raw.fund_id,
    fundName,
    amcName: raw.amc_name ?? inferAmcName(fundName),
    type,
    rawType: raw.transaction_type,
    userFacingType: status === 'failed' ? 'Failed' : status === 'reversed' ? 'Reversal' : mapping.userFacingType,
    direction: mapping.direction,
    amount,
    units,
    nav,
    folioNumber: raw.folio_number ?? undefined,
    referenceId,
    paymentMode: raw.payment_mode ?? undefined,
    installmentNumber: raw.installment_number != null ? String(raw.installment_number) : undefined,
    status,
    source: 'cas',
    includedInInvestedAmount: status === 'success' && mapping.includedInInvestedAmount,
    includedInXirr: status === 'success' && mapping.includedInXirr,
    includedInCurrentHoldings: status === 'success' && mapping.includedInCurrentHoldings,
    hiddenByDefault,
    hiddenReason: hiddenByDefault ? mapping.hiddenReason ?? statusLabel(status) : undefined,
  };
}

export function hideReversalPairs(transactions: PortfolioTransaction[]): PortfolioTransaction[] {
  const reversalKeys = new Set(
    transactions
      .filter((tx) => tx.type === 'reversal' || tx.status === 'reversed')
      .map((tx) => reversalPairKey(tx)),
  );

  if (reversalKeys.size === 0) return transactions;

  return transactions.map((tx) => {
    if (tx.hiddenByDefault) return tx;
    if (!['purchase', 'sip_purchase', 'redemption'].includes(tx.type)) return tx;
    if (!reversalKeys.has(reversalPairKey(tx))) return tx;
    return {
      ...tx,
      status: 'hidden',
      hiddenByDefault: true,
      hiddenReason: 'Matched reversal',
      includedInInvestedAmount: false,
      includedInXirr: false,
      includedInCurrentHoldings: false,
    };
  });
}

function reversalPairKey(tx: PortfolioTransaction): string {
  return [
    tx.fundId,
    tx.date,
    tx.amount.toFixed(2),
    (tx.units ?? 0).toFixed(4),
  ].join('|');
}

export function buildMoneyTrailTransactions(rawRows: RawMoneyTrailTransaction[]): PortfolioTransaction[] {
  return hideReversalPairs(rawRows.map(buildPortfolioTransaction));
}

export function buildMoneyTrailSummary(transactions: PortfolioTransaction[]): MoneyTrailSummary {
  return transactions.reduce<MoneyTrailSummary>(
    (summary, tx) => {
      if (tx.hiddenByDefault) return summary;
      if (tx.direction === 'money_in') summary.totalInvested += tx.amount;
      if (tx.direction === 'money_out') summary.totalWithdrawn += tx.amount;
      if (tx.direction !== 'neutral') summary.transactionCount += 1;
      summary.netInvested = summary.totalInvested - summary.totalWithdrawn;
      return summary;
    },
    { totalInvested: 0, totalWithdrawn: 0, netInvested: 0, transactionCount: 0 },
  );
}

export function buildAnnualMoneyFlows(transactions: PortfolioTransaction[]): AnnualMoneyFlow[] {
  const byYear = new Map<string, AnnualMoneyFlow>();

  for (const tx of transactions) {
    if (tx.hiddenByDefault) continue;
    const existing = byYear.get(tx.financialYear) ?? {
      financialYear: tx.financialYear,
      invested: 0,
      withdrawn: 0,
      netInvested: 0,
      transactionCount: 0,
    };

    if (tx.direction === 'money_in') existing.invested += tx.amount;
    if (tx.direction === 'money_out') existing.withdrawn += tx.amount;
    if (tx.direction !== 'neutral') existing.transactionCount += 1;
    existing.netInvested = existing.invested - existing.withdrawn;
    byYear.set(tx.financialYear, existing);
  }

  return [...byYear.values()].sort((a, b) => compareFinancialYears(a.financialYear, b.financialYear));
}

export function sortMoneyTrailTransactions(
  transactions: PortfolioTransaction[],
  sortBy: MoneyTrailSortOption,
): PortfolioTransaction[] {
  return [...transactions].sort((a, b) => {
    switch (sortBy) {
      case 'oldest':
        return a.date.localeCompare(b.date) || a.fundName.localeCompare(b.fundName);
      case 'amount_desc':
        return b.amount - a.amount || b.date.localeCompare(a.date);
      case 'amount_asc':
        return a.amount - b.amount || b.date.localeCompare(a.date);
      case 'fund_asc':
        return a.fundName.localeCompare(b.fundName) || b.date.localeCompare(a.date);
      case 'fund_desc':
        return b.fundName.localeCompare(a.fundName) || b.date.localeCompare(a.date);
      case 'newest':
      default:
        return b.date.localeCompare(a.date) || a.fundName.localeCompare(b.fundName);
    }
  });
}

export function filterMoneyTrailTransactions(
  transactions: PortfolioTransaction[],
  filters: MoneyTrailFilters,
  now = new Date(),
): PortfolioTransaction[] {
  const dateRange = getFilterDateRange(filters, now);

  return transactions.filter((tx) => {
    if (!filters.includeHidden && tx.hiddenByDefault) return false;
    if (dateRange && (tx.date < dateRange.start || tx.date > dateRange.end)) return false;
    if (filters.transactionTypes.length > 0 && !filters.transactionTypes.includes(tx.type)) return false;
    if (filters.directions.length > 0 && !filters.directions.includes(tx.direction)) return false;
    if (filters.amcNames.length > 0 && !filters.amcNames.includes(tx.amcName ?? 'Not available')) return false;
    if (filters.fundIds.length > 0 && !filters.fundIds.includes(tx.fundId)) return false;
    if (filters.minAmount != null && tx.amount < filters.minAmount) return false;
    if (filters.maxAmount != null && tx.amount > filters.maxAmount) return false;
    return true;
  });
}

export function searchMoneyTrailTransactions(
  transactions: PortfolioTransaction[],
  query: string,
): PortfolioTransaction[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return transactions;

  return transactions.filter((tx) => {
    const haystack = [
      tx.fundName,
      tx.amcName,
      tx.userFacingType,
      tx.amount.toString(),
      tx.folioNumber,
      tx.referenceId,
      tx.status,
      tx.financialYear,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export function applyMoneyTrailControls(
  transactions: PortfolioTransaction[],
  filters: MoneyTrailFilters,
  query: string,
  sortBy: MoneyTrailSortOption,
  now = new Date(),
): PortfolioTransaction[] {
  return sortMoneyTrailTransactions(
    searchMoneyTrailTransactions(filterMoneyTrailTransactions(transactions, filters, now), query),
    sortBy,
  );
}

export function getDatePresetRange(
  preset: MoneyTrailDatePreset,
  now = new Date(),
): { start: string; end: string } | null {
  const end = toIsoDate(now);

  if (preset === 'all_time' || preset === 'custom') return null;

  if (preset === 'last_3_months') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCMonth(start.getUTCMonth() - 3);
    return { start: toIsoDate(start), end };
  }

  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const currentFyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  const startYear = preset === 'this_fy' ? currentFyStartYear : currentFyStartYear - 1;
  return {
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
  };
}

export function getFilterDateRange(
  filters: Pick<MoneyTrailFilters, 'datePreset' | 'customStartDate' | 'customEndDate'>,
  now = new Date(),
): { start: string; end: string } | null {
  if (filters.datePreset !== 'custom') return getDatePresetRange(filters.datePreset, now);
  const start = filters.customStartDate?.trim();
  const end = filters.customEndDate?.trim();
  if (!start && !end) return null;
  return {
    start: start || '0000-01-01',
    end: end || toIsoDate(now),
  };
}

export function compareFinancialYears(a: string, b: string): number {
  return financialYearStart(a) - financialYearStart(b);
}

export function buildMoneyTrailCsv(transactions: PortfolioTransaction[]): string {
  const rows = [
    [
      'Date',
      'Financial Year',
      'Transaction Type',
      'Direction',
      'Fund Name',
      'AMC',
      'Folio Number',
      'Amount',
      'Units',
      'NAV',
      'Status',
      'Included In Invested Amount',
      'Used In XIRR Calculation',
      'Reference ID',
    ],
    ...transactions.map((tx) => [
      tx.date,
      tx.financialYear,
      tx.userFacingType,
      directionLabel(tx.direction),
      tx.fundName,
      tx.amcName ?? '',
      tx.folioNumber ?? '',
      tx.amount.toString(),
      tx.units?.toString() ?? '',
      tx.nav?.toString() ?? '',
      statusLabel(tx.status),
      tx.includedInInvestedAmount ? 'Yes' : 'No',
      tx.includedInXirr ? 'Yes' : 'No',
      tx.referenceId ?? '',
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

export function directionLabel(direction: MoneyTrailDirection): string {
  switch (direction) {
    case 'money_in':
      return 'Money in';
    case 'money_out':
      return 'Money out';
    case 'internal':
      return 'Internal movement';
    case 'neutral':
    default:
      return 'Neutral';
  }
}

export function statusLabel(status: MoneyTrailStatus): string {
  switch (status) {
    case 'success':
      return 'Success';
    case 'failed':
      return 'Failed';
    case 'reversed':
      return 'Reversed';
    case 'hidden':
      return 'Hidden';
    default:
      return 'Success';
  }
}

export function transactionUseExplanation(tx: PortfolioTransaction): string {
  if (tx.status === 'reversed' || tx.status === 'hidden' || tx.status === 'failed') {
    return 'This transaction was reversed or failed and is not included in your portfolio totals.';
  }
  if (tx.type === 'switch_in' || tx.type === 'switch_out' || tx.type === 'stp_in' || tx.type === 'stp_out') {
    return 'This moved money between funds. It is not counted as fresh investment.';
  }
  if (tx.type === 'dividend_reinvestment') {
    return 'This dividend was reinvested into the fund.';
  }
  if (tx.type === 'dividend_payout') {
    return 'This dividend was paid out to you.';
  }
  return 'This transaction is included in your portfolio history and return calculations.';
}

export function formatMoneyTrailDate(dateIso: string): string {
  const date = parseIsoDate(dateIso);
  if (!date) return dateIso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function getUniqueFundOptions(transactions: PortfolioTransaction[]) {
  const map = new Map<string, string>();
  for (const tx of transactions) map.set(tx.fundId, tx.fundName);
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getUniqueAmcOptions(transactions: PortfolioTransaction[]) {
  return [...new Set(transactions.map((tx) => tx.amcName ?? 'Not available'))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function normalizeStatus(rawStatus?: string | null): MoneyTrailStatus | null {
  if (!rawStatus) return null;
  const status = rawStatus.toLowerCase();
  if (status.includes('fail') || status.includes('reject')) return 'failed';
  if (status.includes('reverse') || status.includes('cancel')) return 'reversed';
  if (status.includes('hide')) return 'hidden';
  if (status.includes('success') || status.includes('complete')) return 'success';
  return null;
}

function finiteOrUndefined(value: number | null | undefined): number | undefined {
  if (value == null) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function parseIsoDate(dateIso: string): Date | null {
  const date = new Date(`${dateIso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function financialYearStart(financialYear: string): number {
  const match = financialYear.match(/^FY\s+(\d{4})-/);
  return match ? Number(match[1]) : Number.NEGATIVE_INFINITY;
}

function inferAmcName(fundName: string): string | undefined {
  const knownPrefixes = [
    'Aditya Birla Sun Life',
    'Axis',
    'Bandhan',
    'DSP',
    'Franklin Templeton',
    'HDFC',
    'HSBC',
    'ICICI Prudential',
    'Kotak',
    'Mirae Asset',
    'Motilal Oswal',
    'Nippon India',
    'Parag Parikh',
    'PPFAS',
    'SBI',
    'Tata',
    'UTI',
  ];
  const prefix = knownPrefixes.find((candidate) =>
    fundName.toLowerCase().startsWith(candidate.toLowerCase()),
  );
  return prefix ? `${prefix} Mutual Fund` : undefined;
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
