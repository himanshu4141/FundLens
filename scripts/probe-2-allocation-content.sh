#!/usr/bin/env bash
# probe-2-allocation-content.sh
#
# Probe 2: Inspect the /families/{id}/allocation endpoint in detail.
#
# Probe 1 revealed that /allocation is NOT always null — it returns
# {"allocations": ..., "portfolio_date": ...}. This script prints the
# full allocations content for all 7 original funds so we can assess
# whether this endpoint can replace the unreliable holdings-derived totals.
#
# Usage: bash probe-2-allocation-content.sh 2>&1 | tee probe-2-output.txt

set -euo pipefail
MFDATA="https://mfdata.in/api/v1"

FUNDS=(
  "5148|SBI Large Cap|large_cap_fund"
  "760|DSP Large Cap|large_cap_fund"
  "7428|PPFAS Flexi Cap|flexi_cap_fund"
  "772|DSP Aggressive Hybrid|aggressive_hybrid_fund"
  "1378|HDFC Balanced Advantage|balanced_advantage_fund"
  "1296|HDFC Corporate Bond|corporate_bond_fund"
  "1387|HDFC Developed World FoF|fund_of_funds_overseas"
)

fetch_json() {
  curl -s --max-time 15 \
    -H "Accept: application/json" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
    "$1"
}

hr() { printf '\n%s\n' "$(printf '=%.0s' {1..70})"; }

for entry in "${FUNDS[@]}"; do
  IFS='|' read -r FAMILY_ID LABEL CATEGORY <<< "$entry"
  hr
  echo "FUND:     $LABEL (family $FAMILY_ID)"
  echo "CATEGORY: $CATEGORY"

  RESP=$(fetch_json "$MFDATA/families/$FAMILY_ID/allocation")

  if ! echo "$RESP" | jq . >/dev/null 2>&1; then
    echo "ERROR: non-JSON response"
    echo "$RESP" | head -3
    sleep 1; continue
  fi

  echo ""
  echo "[portfolio_date]"
  echo "$RESP" | jq '.data.portfolio_date'

  echo ""
  echo "[allocations — full content]"
  echo "$RESP" | jq '.data.allocations'

  sleep 1
done

hr
echo "DONE. Key questions to answer from this output:"
echo "  1. Does allocations contain asset class percentages (equity/debt/other)?"
echo "  2. Does it include large/mid/small cap breakdown?"
echo "  3. Is the data structured (array of objects?) or a flat object?"
echo "  4. Does the portfolio_date match the holdings month we saw in probe 1?"
echo "  5. For DSP Large Cap: does allocation show 89% equity or the corrupted 140%?"
