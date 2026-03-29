function normalizePlanType(value: string): 'Direct' | 'Regular' {
  return /^dir/i.test(value) ? 'Direct' : 'Regular';
}

function normalizeOption(value: string): string {
  const compact = value.trim().replace(/\s+/g, ' ');
  if (/^growth/i.test(compact)) return 'Growth';
  if (/^idcw/i.test(compact)) return 'IDCW';
  if (/^dividend/i.test(compact)) return 'Dividend';
  return compact;
}

const PLAN_PATTERNS = [
  /^(.+?)\s*-\s*(Direct|Regular|Dir|Reg)\s+Plan\s*-\s*(Growth(?:\s+Option)?|IDCW.*|Dividend.*)$/i,
  /^(.+?)\s*-\s*(Direct|Regular|Dir|Reg)\s+Plan\s+(Growth(?:\s+Option)?|IDCW.*|Dividend.*)$/i,
  /^(.+?)\s*-\s*(Direct|Regular|Dir|Reg)\s*-\s*(Growth(?:\s+Option)?|IDCW.*|Dividend.*)$/i,
  /^(.+?)\s*-\s*(Direct|Regular|Dir|Reg)\s+(Growth(?:\s+Option)?|IDCW.*|Dividend.*)\s+Plan$/i,
  /^(.+?)\s+(Direct|Regular|Dir|Reg)\s+Plan\s+(Growth(?:\s+Option)?|IDCW.*|Dividend.*)$/i,
];

/**
 * parseFundName — splits a full AMFI fund name into a display name and plan badge.
 *
 * Handles common AMC variants such as:
 * - "Fund - Direct Plan - Growth"
 * - "Fund - Direct Plan Growth"
 * - "Fund - Direct Growth Plan"
 * - "Fund - Dir - Growth"
 * - "Fund - Direct Plan - Growth Option"
 *
 * Unrecognised format:
 * → { base: originalName, planBadge: null }
 */
export function parseFundName(name: string): { base: string; planBadge: string | null } {
  const trimmed = name.trim();
  if (!trimmed) return { base: name, planBadge: null };

  for (const pattern of PLAN_PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match) continue;

    const base = match[1].trim();
    const planType = normalizePlanType(match[2]);
    const option = normalizeOption(match[3]);

    return { base, planBadge: `${planType} · ${option}` };
  }

  return { base: name, planBadge: null };
}
