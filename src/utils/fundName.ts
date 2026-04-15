/**
 * parseFundName — splits a full AMFI fund name into a display name and plan badge.
 *
 * Handles real-world AMFI/CAS naming patterns:
 *   "HDFC Flexi Cap Fund - Direct Plan - Growth"
 *   → { base: "HDFC Flexi Cap Fund", planBadge: "Direct · Growth" }
 *
 *   "Axis Long Term Equity Fund - Regular Plan - IDCW"
 *   → { base: "Axis Long Term Equity Fund", planBadge: "Regular · IDCW" }
 *
 *   "Nippon India Fund - Direct Plan - Payout of IDCW"
 *   → { base: "Nippon India Fund", planBadge: "Direct · IDCW" }
 *
 *   "Franklin India Fund-Direct Plan-Dividend Reinvestment"  (no spaces around hyphens)
 *   → { base: "Franklin India Fund", planBadge: "Direct · Dividend" }
 *
 *   Unrecognised format:
 *   → { base: originalName, planBadge: null }
 */

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
  // Flexible hyphens: allow 0–2 spaces on each side (\s*-\s* instead of \s+-\s+)
  // Option pattern covers: Growth, IDCW*, Dividend*, Payout*, Reinvestment*, Bonus
  const match = name.match(
    /^(.+?)\s*-\s*(Direct|Regular)\s+Plan\s*-\s*(Growth\b.*|IDCW\b.*|Dividend\b.*|Payout\b.*|Reinvestment\b.*|Bonus\b.*)$/i
  );
  if (!match) return { base: name, planBadge: null };

  const planType = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
  const option = normaliseOption(match[3]);

  return { base: match[1].trim(), planBadge: `${planType} · ${option}` };
}
