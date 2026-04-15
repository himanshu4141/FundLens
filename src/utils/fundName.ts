/**
 * parseFundName — splits a full AMFI/CAS fund name into a display name and plan badge.
 *
 * Handles the following real-world naming patterns:
 *
 *   Standard (hyphen-separated):
 *     "HDFC Flexi Cap Fund - Direct Plan - Growth"         → "Direct · Growth"
 *     "Axis Fund - Regular Plan - IDCW Reinvestment"       → "Regular · IDCW"
 *     "Nippon Fund - Direct Plan - Payout of IDCW"         → "Direct · IDCW"
 *     "Franklin Fund-Direct Plan-Dividend Reinvestment"    → "Direct · Dividend"
 *
 *   No second hyphen (option appended after Plan):
 *     "Parag Parikh Flexi Cap Fund - Direct Plan Growth"   → "Direct · Growth"
 *     "HDFC Flexi Cap Fund - Direct Plan - Growth Option"  → "Direct · Growth"
 *
 *   Option before "Plan" (Direct <Option> Plan):
 *     "HDFC Small Cap Fund - Direct Growth Plan"           → "Direct · Growth"
 *
 *   "Dir" abbreviation for Direct (with "Plan"):
 *     "DSP Nifty 50 Index Fund - Dir - Growth"             → "Direct · Growth"
 *
 *   "Dir" abbreviation without "Plan" keyword:
 *     "DSP Nifty 50 Index Fund - Dir - Growth"             → "Direct · Growth"
 *
 *   Unrecognised format:
 *     → { base: originalName, planBadge: null }
 */

/** Normalise plan type abbreviations to canonical form. */
function normalisePlanType(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (lower === 'dir' || lower.startsWith('direct')) return 'Direct';
  return 'Regular';
}

/** Normalise the raw option word(s) to a short display label. */
function normaliseOption(raw: string): string {
  const lower = raw.toLowerCase().trim();

  // "IDCW *" or "* IDCW" (e.g. "IDCW Reinvestment", "Payout of IDCW")
  if (lower.includes('idcw')) return 'IDCW';

  // "Dividend *" (e.g. "Dividend Reinvestment", "Dividend Payout")
  if (lower.startsWith('dividend')) return 'Dividend';

  // "Payout *" / "Reinvestment *" without IDCW — assume Dividend variant
  if (lower.startsWith('payout') || lower.startsWith('reinvestment')) return 'Dividend';

  // "Growth" / "Growth Option"
  if (lower.startsWith('growth')) return 'Growth';

  // Bonus
  if (lower.startsWith('bonus')) return 'Bonus';

  // Fallback: capitalise first word
  const first = raw.trim().split(/\s+/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function parseFundName(name: string): { base: string; planBadge: string | null } {
  // Pattern 1 (standard + no-second-hyphen):
  //   "FUND - Direct Plan - Growth"   (standard, with or without spaces around hyphens)
  //   "FUND - Direct Plan Growth"     (no second hyphen, option after Plan)
  //   "FUND - Dir - Growth"           (Dir abbreviation)
  const p1 = name.match(
    /^(.+?)\s*-\s*(Direct|Regular|Dir)\s+Plan\s*(?:-\s*|\s+)(.+)$/i
  );
  if (p1) {
    const planType = normalisePlanType(p1[2]);
    const option = normaliseOption(p1[3]);
    return { base: p1[1].trim(), planBadge: `${planType} · ${option}` };
  }

  // Pattern 2 (option before "Plan"):
  //   "FUND - Direct Growth Plan"
  const p2 = name.match(
    /^(.+?)\s*-\s*(Direct|Regular|Dir)\s+(.+?)\s+Plan\s*$/i
  );
  if (p2) {
    const planType = normalisePlanType(p2[2]);
    const option = normaliseOption(p2[3]);
    return { base: p2[1].trim(), planBadge: `${planType} · ${option}` };
  }

  // Pattern 3 ("Dir" abbreviation without "Plan" keyword):
  //   "FUND - Dir - Growth"
  const p3 = name.match(
    /^(.+?)\s*-\s*(Dir)\s*-\s*(.+)$/i
  );
  if (p3) {
    const planType = normalisePlanType(p3[2]);
    const option = normaliseOption(p3[3]);
    return { base: p3[1].trim(), planBadge: `${planType} · ${option}` };
  }

  return { base: name, planBadge: null };
}
