#!/usr/bin/env bash
# probe-7-holding-types.sh
#
# Probe 7: Build a full taxonomy of holding_type codes across all tested funds.
#
# Probe 1 revealed holding_type values: BT, CD, DG, FO, CQ, EX — but we don't
# have a complete picture. This probe runs across all 17 funds and collects every
# unique (holding_type, example_name) pair so we can build a definitive lookup
# table for what each code means when parsing holdings.
#
# The taxonomy is needed for correctly filtering and labelling debt instruments
# in the TypeScript interface expansion (Phase A, item A1).
#
# Usage: bash probe-7-holding-types.sh 2>&1 | tee probe-7-output.txt

set -euo pipefail
MFDATA="https://mfdata.in/api/v1"

# All scheme codes tested across probes 1–5
FUNDS=(
  "119598|SBI Large Cap"
  "119250|DSP Large Cap"
  "122639|PPFAS Flexi Cap"
  "119019|DSP Aggressive Hybrid"
  "118968|HDFC Balanced Advantage"
  "118987|HDFC Corporate Bond"
  "149180|HDFC Developed World FoF"
  "120465|Axis Large Cap"
  "118825|Mirae Asset Large Cap"
  "118632|Nippon India Large Cap"
  "119160|Tata Large Cap"
  "120166|Kotak Flexicap"
  "118989|HDFC Mid Cap"
  "120377|ICICI Balanced Advantage"
  "148381|Motilal Oswal S&P 500"
  "134923|Nippon India US Equity"
  "149816|DSP Global Innovation FoF"
)

fetch_json() {
  curl -s --max-time 15 \
    -H "Accept: application/json" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
    "$1"
}

hr() { printf '\n%s\n' "$(printf '=%.0s' {1..70})"; }

# Collect (type_code, array_source, example_name) triples into a temp file
TMPFILE=$(mktemp)

for entry in "${FUNDS[@]}"; do
  IFS='|' read -r SCHEME_CODE LABEL <<< "$entry"
  echo -n "  Processing $LABEL... "

  SCHEME_RESP=$(fetch_json "$MFDATA/schemes/$SCHEME_CODE")
  FAMILY_ID=$(echo "$SCHEME_RESP" | jq -r '.data.family_id // empty' 2>/dev/null)
  if [[ -z "$FAMILY_ID" ]]; then echo "no family_id, skip"; sleep 0.3; continue; fi

  sleep 0.3
  HOLD_RESP=$(fetch_json "$MFDATA/families/$FAMILY_ID/holdings")

  # equity_holdings — these use holding_type only rarely; note when present
  echo "$HOLD_RESP" | jq -r --arg fund "$LABEL" '
    (.data.equity_holdings // [])[] |
    select(.holding_type != null) |
    [$fund, "equity_holdings", .holding_type, (.stock_name // .name // "?")] |
    @tsv' >> "$TMPFILE" 2>/dev/null || true

  # debt_holdings
  echo "$HOLD_RESP" | jq -r --arg fund "$LABEL" '
    (.data.debt_holdings // [])[] |
    select(.holding_type != null) |
    [$fund, "debt_holdings", .holding_type, (.name // "?")] |
    @tsv' >> "$TMPFILE" 2>/dev/null || true

  # other_holdings
  echo "$HOLD_RESP" | jq -r --arg fund "$LABEL" '
    (.data.other_holdings // [])[] |
    select(.holding_type != null) |
    [$fund, "other_holdings", .holding_type, (.name // "?")] |
    @tsv' >> "$TMPFILE" 2>/dev/null || true

  echo "done"
  sleep 0.5
done

hr
echo "HOLDING TYPE TAXONOMY"
echo ""
echo "Unique (array_source, holding_type) combinations with one example name each:"
echo ""
printf "%-20s %-8s %s\n" "ARRAY" "TYPE" "EXAMPLE NAME"
printf "%-20s %-8s %s\n" "--------------------" "--------" "-------------------------------------------"

sort -k2,2 -k3,3 "$TMPFILE" | awk -F'\t' '
  !seen[$2,$3]++ {
    printf "%-20s %-8s %s\n", $2, $3, $4
  }
'

hr
echo ""
echo "Count of entries per holding_type (across all funds and arrays):"
awk -F'\t' '{print $3}' "$TMPFILE" | sort | uniq -c | sort -rn

hr
echo ""
echo "Full deduplicated list of (fund, array, type, name) for DEBT holdings only:"
echo "Sorted by holding_type, then fund:"
echo ""
grep $'\tdebt_holdings\t' "$TMPFILE" | sort -t$'\t' -k3,3 -k1,1 | awk -F'\t' '
  !seen[$1,$3]++ {
    printf "%-30s %-8s %s\n", $1, $3, $4
  }
'

rm -f "$TMPFILE"

hr
echo "DONE. This output builds the complete holding_type → meaning table."
echo "Common types seen so far:"
echo "  BT  — bonds / G-Sec / treasury (maturity dates in 2025-2065)"
echo "  CD  — certificate of deposit (short maturity, bank issuers, CRISIL A1+)"
echo "  DG  — derivatives / equity derivatives (negative market values possible)"
echo "  FO  — fund unit (ETF or mutual fund holding)"
echo "  CQ  — cash offset for derivatives"
echo "  EX  — other/exchange-listed instrument"
echo ""
echo "Any new types in the output above should be investigated."
