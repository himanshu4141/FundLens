#!/usr/bin/env bash
# probe-3-ppfas-deep.sh
#
# Probe 3: PPFAS Flexi Cap deep dive.
#
# Probe 1 found PPFAS has equity_pct=78.46% (official is ~96-97%) and an
# unusual 79 equity_holdings AND 79 debt_holdings. This probe prints the
# full holdings to find out:
#   a) Are overseas stocks (Alphabet, Meta, Amazon, Microsoft) in equity_holdings?
#   b) Are the 79 debt_holdings real debt instruments or misclassified entries?
#   c) Does the month/fetched_at field reveal stale data as the cause?
#
# PPFAS family_id = 7428 (scheme_code 122639)
#
# Usage: bash probe-3-ppfas-deep.sh 2>&1 | tee probe-3-output.txt

set -euo pipefail
MFDATA="https://mfdata.in/api/v1"
FAMILY_ID=7428

fetch_json() {
  curl -s --max-time 15 \
    -H "Accept: application/json" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
    "$1"
}

hr() { printf '\n%s\n' "$(printf '=%.0s' {1..70})"; }

RESP=$(fetch_json "$MFDATA/families/$FAMILY_ID/holdings")

hr
echo "PPFAS Flexi Cap — family $FAMILY_ID"
echo ""

echo "[metadata]"
echo "$RESP" | jq '{month: .data.month, fetched_at: .data.fetched_at, equity_pct: .data.equity_pct, debt_pct: .data.debt_pct, other_pct: .data.other_pct}'

hr
echo "ALL EQUITY HOLDINGS (sorted by weight, descending)"
echo "Looking for: Alphabet/Google, Meta, Amazon, Microsoft, any non-Indian stock"
echo ""
echo "$RESP" | jq '[.data.equity_holdings[] | {stock_name, sector, isin, weight_pct}] | sort_by(-.weight_pct)'

hr
echo "ALL DEBT HOLDINGS (sorted by weight, descending)"
echo "Checking if these are real debt instruments (CDs, bonds) or something else"
echo ""
echo "$RESP" | jq '[.data.debt_holdings[] | {name, credit_rating, maturity_date, holding_type, weight_pct}] | sort_by(-.weight_pct)'

hr
echo "ALL OTHER HOLDINGS"
echo ""
echo "$RESP" | jq '[.data.other_holdings[] | {name, holding_type, weight_pct}] | sort_by(-.weight_pct)'

hr
echo "SUMMARY"
echo "$RESP" | jq '{
  equity_holdings_total_weight: ([.data.equity_holdings[].weight_pct] | add),
  debt_holdings_total_weight:   ([.data.debt_holdings[].weight_pct // 0] | add),
  other_holdings_total_weight:  ([.data.other_holdings[].weight_pct // 0] | add),
  reported_equity_pct: .data.equity_pct,
  reported_debt_pct:   .data.debt_pct,
  reported_other_pct:  .data.other_pct
}'

hr
echo "UNIQUE holding_type values across all arrays"
echo "$RESP" | jq '[
  (.data.equity_holdings // [] | map(.holding_type // "null")),
  (.data.debt_holdings   // [] | map(.holding_type // "null")),
  (.data.other_holdings  // [] | map(.holding_type // "null"))
] | flatten | unique'
