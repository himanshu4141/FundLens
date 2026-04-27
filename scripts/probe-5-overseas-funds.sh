#!/usr/bin/env bash
# probe-5-overseas-funds.sh
#
# Probe 5: International / overseas funds deep dive.
#
# Three distinct types of "overseas" exposure in the fund universe:
#   Type A — True FoF: holds foreign ETFs/mutual funds  (HDFC Developed World, DSP Global Innovation)
#   Type B — Direct overseas equity: holds individual foreign stocks  (Nippon India US, Motilal S&P 500)
#   Type C — Mixed: domestic fund with partial overseas equity  (PPFAS — covered in probe 3)
#
# Probe 1 already showed HDFC Developed World FoF returns ETF names from mfdata.
# This probe checks the others and answers:
#   1. Does DSP Global Innovation also return ETF names?
#   2. Do Nippon US and Motilal S&P 500 return individual US stock names?
#   3. Do any of these have ISINs (possibly international ISINs)?
#   4. What does equity_pct look like for these funds?
#   5. What holding_type values appear (FO = foreign fund, others)?
#
# Usage: bash probe-5-overseas-funds.sh 2>&1 | tee probe-5-output.txt

set -euo pipefail
MFDATA="https://mfdata.in/api/v1"

FUNDS=(
  "149816|DSP Global Innovation FoF|fund_of_funds_overseas"
  "134923|Nippon India US Equity|thematic_overseas_direct_equity"
  "148381|Motilal Oswal S&P 500 Index|index_fund_overseas"
)

fetch_json() {
  curl -s --max-time 15 \
    -H "Accept: application/json" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
    "$1"
}

hr() { printf '\n%s\n' "$(printf '=%.0s' {1..70})"; }

for entry in "${FUNDS[@]}"; do
  IFS='|' read -r SCHEME_CODE LABEL CATEGORY <<< "$entry"
  hr
  echo "FUND:     $LABEL ($CATEGORY)"
  echo "SCHEME:   $SCHEME_CODE"

  SCHEME_RESP=$(fetch_json "$MFDATA/schemes/$SCHEME_CODE")
  FAMILY_ID=$(echo "$SCHEME_RESP" | jq -r '.data.family_id // empty' 2>/dev/null)
  if [[ -z "$FAMILY_ID" ]]; then
    echo "SKIP: no family_id"
    sleep 0.5; continue
  fi
  echo "FAMILY:   $FAMILY_ID"
  sleep 0.3

  RESP=$(fetch_json "$MFDATA/families/$FAMILY_ID/holdings")

  echo ""
  echo "[allocation + metadata]"
  echo "$RESP" | jq '{
    month: .data.month,
    equity_pct: .data.equity_pct,
    debt_pct:   .data.debt_pct,
    other_pct:  .data.other_pct,
    equity_holdings_count: (.data.equity_holdings | if . == null then "null" else length end),
    debt_holdings_count:   (.data.debt_holdings   | if . == null then "null" else length end),
    other_holdings_count:  (.data.other_holdings  | if . == null then "null" else length end)
  }'

  echo ""
  echo "[ALL equity_holdings — name, isin, sector, holding_type if present, weight_pct]"
  echo "$RESP" | jq '[.data.equity_holdings[] | {
    stock_name,
    isin,
    sector,
    weight_pct
  }] | sort_by(-.weight_pct)'

  echo ""
  echo "[ALL other_holdings — name, holding_type, weight_pct]"
  echo "$RESP" | jq '[(.data.other_holdings // [])[] | {
    name,
    holding_type,
    weight_pct
  }] | sort_by(-.weight_pct)'

  echo ""
  echo "[debt_holdings sample (first 3)]"
  echo "$RESP" | jq '[(.data.debt_holdings // [])[] | {
    name, credit_rating, maturity_date, holding_type, weight_pct
  }] | .[0:3]'

  echo ""
  echo "[unique holding_type values across all arrays]"
  echo "$RESP" | jq '[
    (.data.equity_holdings // [] | map(.holding_type // "null")),
    (.data.debt_holdings   // [] | map(.holding_type // "null")),
    (.data.other_holdings  // [] | map(.holding_type // "null"))
  ] | flatten | unique'

  sleep 1
done

hr
echo "DONE. Key questions:"
echo "  1. Does DSP Global Innovation return ETF names (like HDFC Developed World did)?"
echo "  2. Do Nippon US and Motilal S&P 500 return individual stock names (Apple, Nvidia etc.)?"
echo "  3. Are any ISINs populated for foreign holdings?"
echo "  4. What holding_type values appear for foreign ETF / foreign equity entries?"
