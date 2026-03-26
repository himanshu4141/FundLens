/**
 * parseFundName — splits a full AMFI fund name into a display name and plan badge.
 *
 * Example:
 *   "HDFC Flexi Cap Fund - Direct Plan - Growth"
 *   → { base: "HDFC Flexi Cap Fund", planBadge: "Direct · Growth" }
 *
 *   "Axis Long Term Equity Fund - Regular Plan - IDCW"
 *   → { base: "Axis Long Term Equity Fund", planBadge: "Regular · IDCW" }
 *
 *   Unrecognised format:
 *   → { base: originalName, planBadge: null }
 */
export function parseFundName(name: string): { base: string; planBadge: string | null } {
  const match = name.match(/^(.+?)\s+-\s+(Direct|Regular)\s+Plan\s+-\s+(Growth|IDCW.*|Dividend.*)$/i);
  if (!match) return { base: name, planBadge: null };
  const planType = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase(); // "Direct" / "Regular"
  const optionWord = match[3].split(/\s+/)[0]; // first word: "Growth" / "IDCW" / "Dividend"
  const option = optionWord.charAt(0).toUpperCase() + optionWord.slice(1).toLowerCase();
  return { base: match[1], planBadge: `${planType} · ${option}` };
}
