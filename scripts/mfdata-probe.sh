#!/usr/bin/env bash
# mfdata-probe.sh
#
# Probes the mfdata.in API for a representative set of funds and prints the
# raw response structure. Purpose: verify whether debt_holdings / other_holdings
# fields exist, check equity_pct values, and confirm the /allocation endpoint
# behaviour before writing any parsing code.
#
# Requirements: curl, jq (brew install jq / apt install jq)
# Usage: bash mfdata-probe.sh 2>&1 | tee mfdata-probe-output.txt
# Then share mfdata-probe-output.txt so we can check the field names.

set -euo pipefail

MFDATA="https://mfdata.in/api/v1"

# ---------------------------------------------------------------------------
# Funds to probe — one per relevant category
# ---------------------------------------------------------------------------
# Format: "SCHEME_CODE|Label|Category"
FUNDS=(
  "119598|SBI Large Cap|large_cap_fund"
  "119250|DSP Large Cap|large_cap_fund"
  "122639|PPFAS Flexi Cap|flexi_cap_fund"
  "119019|DSP Aggressive Hybrid|aggressive_hybrid_fund"
  "118968|HDFC Balanced Advantage|balanced_advantage_fund"
  "118987|HDFC Corporate Bond|corporate_bond_fund"
  "149180|HDFC Developed World FoF|fund_of_funds_overseas"
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

hr() { printf '\n%s\n' "$(printf '=%.0s' {1..70})"; }

fetch_json() {
  curl -s --max-time 15 \
    -H "Accept: application/json" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
    "$1"
}

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

for entry in "${FUNDS[@]}"; do
  IFS='|' read -r SCHEME_CODE LABEL CATEGORY <<< "$entry"

  hr
  echo "FUND:     $LABEL"
  echo "SCHEME:   $SCHEME_CODE"
  echo "CATEGORY: $CATEGORY"

  # Step 1 — get family_id from scheme
  echo ""
  echo "--- 1. GET /schemes/$SCHEME_CODE ---"
  SCHEME_RESP=$(fetch_json "$MFDATA/schemes/$SCHEME_CODE")

  if ! echo "$SCHEME_RESP" | jq . >/dev/null 2>&1; then
    echo "ERROR: non-JSON response from /schemes/$SCHEME_CODE"
    echo "$SCHEME_RESP" | head -5
    continue
  fi

  echo "$SCHEME_RESP" | jq '{status: .status, family_id: .data.family_id, scheme_name: .data.scheme_name, scheme_category: .data.scheme_category}'

  FAMILY_ID=$(echo "$SCHEME_RESP" | jq -r '.data.family_id // empty')
  if [[ -z "$FAMILY_ID" ]]; then
    echo "SKIP: no family_id returned"
    continue
  fi

  sleep 0.5

  # Step 2 — check the /allocation endpoint (expected to return null)
  echo ""
  echo "--- 2. GET /families/$FAMILY_ID/allocation ---"
  ALLOC_RESP=$(fetch_json "$MFDATA/families/$FAMILY_ID/allocation")
  if echo "$ALLOC_RESP" | jq . >/dev/null 2>&1; then
    echo "$ALLOC_RESP" | jq '{status: .status, data_is_null: (.data == null), top_level_keys: (.data | if . == null then "null" else keys end)}'
  else
    echo "$ALLOC_RESP" | head -3
  fi

  sleep 0.5

  # Step 3 — fetch holdings
  echo ""
  echo "--- 3. GET /families/$FAMILY_ID/holdings ---"
  HOLDINGS_RESP=$(fetch_json "$MFDATA/families/$FAMILY_ID/holdings")

  if ! echo "$HOLDINGS_RESP" | jq . >/dev/null 2>&1; then
    echo "ERROR: non-JSON response from /families/$FAMILY_ID/holdings"
    echo "$HOLDINGS_RESP" | head -5
    continue
  fi

  # Top-level structure
  echo ""
  echo "[top-level keys in .data]"
  echo "$HOLDINGS_RESP" | jq '.data | keys'

  # Allocation percentages
  echo ""
  echo "[allocation fields]"
  echo "$HOLDINGS_RESP" | jq '{
    equity_pct:       .data.equity_pct,
    debt_pct:         .data.debt_pct,
    other_pct:        .data.other_pct,
    cash_pct:         .data.cash_pct,
    total_check:      ((.data.equity_pct // 0) + (.data.debt_pct // 0) + (.data.other_pct // 0) + (.data.cash_pct // 0))
  }'

  # Array counts
  echo ""
  echo "[holdings array lengths]"
  echo "$HOLDINGS_RESP" | jq '{
    equity_holdings_count: (.data.equity_holdings | if . == null then "null" else length end),
    debt_holdings_count:   (.data.debt_holdings   | if . == null then "null" else length end),
    other_holdings_count:  (.data.other_holdings  | if . == null then "null" else length end)
  }'

  # Sample equity holding (first item) — shows what fields are present
  echo ""
  echo "[sample equity_holding[0] — all fields]"
  echo "$HOLDINGS_RESP" | jq '.data.equity_holdings[0] // "no equity holdings"'

  # Sample debt holding (first item) — this is the key one we need to verify
  echo ""
  echo "[sample debt_holding[0] — all fields]"
  echo "$HOLDINGS_RESP" | jq '.data.debt_holdings[0] // "no debt holdings"'

  # Sample other holding (first item)
  echo ""
  echo "[sample other_holding[0] — all fields]"
  echo "$HOLDINGS_RESP" | jq '.data.other_holdings[0] // "no other holdings"'

  # For debt/hybrid funds: top 5 debt holdings with weights
  DEBT_COUNT=$(echo "$HOLDINGS_RESP" | jq '.data.debt_holdings | if . == null then 0 else length end')
  if [[ "$DEBT_COUNT" -gt 0 ]]; then
    echo ""
    echo "[top 5 debt_holdings by weight_pct]"
    echo "$HOLDINGS_RESP" | jq '[.data.debt_holdings[] | {instrument_name, isin, rating, maturity_date, weight_pct}] | sort_by(-.weight_pct) | .[0:5]'
  fi

  sleep 1
done

hr
echo "DONE. Share the full output (mfdata-probe-output.txt) for analysis."
echo ""
echo "Key things to check in the output:"
echo "  1. Are debt_holdings and other_holdings keys present in .data for hybrid/debt funds?"
echo "  2. What exact field names appear in a debt_holding object?"
echo "  3. Does equity_pct match the fund's known official allocation?"
echo "  4. Does /allocation always return null?"
echo "  5. Does the HDFC Developed World FoF return any holdings at all?"
