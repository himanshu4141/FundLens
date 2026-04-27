#!/usr/bin/env bash
# probe-4-equity-pct-reliability.sh
#
# Probe 4: equity_pct reliability across a broad set of funds.
#
# Probe 1 showed equity_pct is exact for DSP Large Cap but wrong by 18pp for
# PPFAS and 4pp for SBI Large Cap. This probe tests 12 more funds spanning
# all major categories to build a full picture of when mfdata's equity_pct
# can be trusted and when it can't.
#
# Also checks: do ANY of these funds have ISINs populated in equity_holdings?
#
# Usage: bash probe-4-equity-pct-reliability.sh 2>&1 | tee probe-4-output.txt

set -euo pipefail
MFDATA="https://mfdata.in/api/v1"

# Format: "SCHEME_CODE|Label|Category|Expected_equity_pct_approx"
# Expected values from official AMC/Groww data
FUNDS=(
  "120465|Axis Large Cap|large_cap_fund|~99"
  "118825|Mirae Asset Large Cap|large_cap_fund|~100"
  "118632|Nippon India Large Cap|large_cap_fund|~97"
  "119160|Tata Large Cap|large_cap_fund|~97"
  "120166|Kotak Flexicap|flexi_cap_fund|~90"
  "118989|HDFC Mid Cap|mid_cap_fund|~95"
  "120377|ICICI Balanced Advantage|balanced_advantage_fund|~65"
  "148381|Motilal Oswal S&P 500|index_fund|~100"
  "134923|Nippon India US Equity|thematic_overseas|~95"
  "149816|DSP Global Innovation FoF|fund_of_funds_overseas|~100"
)

fetch_json() {
  curl -s --max-time 15 \
    -H "Accept: application/json" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
    "$1"
}

hr() { printf '\n%s\n' "$(printf '=%.0s' {1..70})"; }

echo "equity_pct reliability check — $(date)"
echo ""
printf "%-40s %-12s %-12s %-12s %-12s %-12s %-10s %-10s\n" \
  "Fund" "equity_pct" "debt_pct" "other_pct" "total" "expected" "eq_ct" "isin_null"

for entry in "${FUNDS[@]}"; do
  IFS='|' read -r SCHEME_CODE LABEL CATEGORY EXPECTED <<< "$entry"

  SCHEME_RESP=$(fetch_json "$MFDATA/schemes/$SCHEME_CODE")
  FAMILY_ID=$(echo "$SCHEME_RESP" | jq -r '.data.family_id // empty' 2>/dev/null)

  if [[ -z "$FAMILY_ID" ]]; then
    printf "%-40s %-12s\n" "$LABEL" "NO_FAMILY_ID"
    sleep 0.5; continue
  fi

  sleep 0.3
  HOLD_RESP=$(fetch_json "$MFDATA/families/$FAMILY_ID/holdings")

  EQ_PCT=$(echo "$HOLD_RESP"   | jq -r '.data.equity_pct // "null"')
  DEBT_PCT=$(echo "$HOLD_RESP" | jq -r '.data.debt_pct   // "null"')
  OTH_PCT=$(echo "$HOLD_RESP"  | jq -r '.data.other_pct  // "null"')
  TOTAL=$(echo "$HOLD_RESP"    | jq -r '((.data.equity_pct // 0) + (.data.debt_pct // 0) + (.data.other_pct // 0)) | . * 100 | round / 100')
  EQ_CT=$(echo "$HOLD_RESP"    | jq -r '(.data.equity_holdings | if . == null then 0 else length end)')

  # Check if ANY equity holding has a non-null isin
  ISIN_NULL=$(echo "$HOLD_RESP" | jq -r '
    if (.data.equity_holdings | length) > 0 then
      (.data.equity_holdings | map(.isin) | all(. == null)) | if . then "all_null" else "HAS_ISIN" end
    else "no_eq_holdings" end')

  printf "%-40s %-12s %-12s %-12s %-12s %-12s %-10s %-10s\n" \
    "$LABEL" "$EQ_PCT" "$DEBT_PCT" "$OTH_PCT" "$TOTAL" "$EXPECTED" "$EQ_CT" "$ISIN_NULL"

  sleep 0.5
done

hr
echo ""
echo "Now printing the first equity_holding for any fund where ISIN is NOT null:"
echo "(If no output appears below, ISINs are null universally)"
echo ""

for entry in "${FUNDS[@]}"; do
  IFS='|' read -r SCHEME_CODE LABEL CATEGORY EXPECTED <<< "$entry"

  SCHEME_RESP=$(fetch_json "$MFDATA/schemes/$SCHEME_CODE")
  FAMILY_ID=$(echo "$SCHEME_RESP" | jq -r '.data.family_id // empty' 2>/dev/null)
  [[ -z "$FAMILY_ID" ]] && { sleep 0.5; continue; }

  sleep 0.3
  HOLD_RESP=$(fetch_json "$MFDATA/families/$FAMILY_ID/holdings")

  HAS_ISIN=$(echo "$HOLD_RESP" | jq -r '(.data.equity_holdings // [] | map(.isin) | any(. != null)) | tostring')
  if [[ "$HAS_ISIN" == "true" ]]; then
    echo "=== $LABEL has non-null ISINs ==="
    echo "$HOLD_RESP" | jq '[.data.equity_holdings[] | select(.isin != null)] | .[0:5]'
  fi

  sleep 0.5
done
