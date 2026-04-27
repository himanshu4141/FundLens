#!/usr/bin/env bash
# probe-6-amfi-sources.sh
#
# Probe 6: AMFI data source accessibility.
#
# Two AMFI sources are candidates for Phase B:
#   A) AMFI consolidated portfolio — monthly disclosure from all AMCs (Regulation 59).
#      If machine-readable, one endpoint covers all funds and potentially includes ISINs.
#   B) AMFI biannual stock categorisation list — SEBI-mandated Large/Mid/Small Cap
#      classification for ~500 stocks. Needed for market-cap breakdown in equity holdings.
#      (Blocked in Phase A because mfdata ISINs are null, but needed for Phase B.)
#
# This probe checks whether these endpoints are accessible, what format they return,
# and enough of the content to assess whether they're usable.
#
# Usage: bash probe-6-amfi-sources.sh 2>&1 | tee probe-6-output.txt

set -euo pipefail

hr() { printf '\n%s\n' "$(printf '=%.0s' {1..70})"; }

fetch_check() {
  local URL="$1"
  local DESC="$2"
  echo ""
  echo "URL: $URL"
  echo "DESC: $DESC"
  echo ""

  HTTP_CODE=$(curl -s -o /tmp/probe6_body.txt -w "%{http_code}" \
    --max-time 20 \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
    "$URL")

  echo "HTTP status: $HTTP_CODE"
  FILE_SIZE=$(wc -c < /tmp/probe6_body.txt)
  echo "Response size: $FILE_SIZE bytes"

  if [[ "$HTTP_CODE" == "200" ]] && [[ "$FILE_SIZE" -gt 0 ]]; then
    # Detect content type from first bytes
    FIRST_BYTES=$(head -c 200 /tmp/probe6_body.txt)
    echo "First 200 bytes:"
    echo "$FIRST_BYTES"
    echo ""

    # Try to detect if JSON
    if echo "$FIRST_BYTES" | grep -q '^\s*[{\[]'; then
      echo "Content looks like JSON. First object keys:"
      python3 -c "
import json, sys
try:
    with open('/tmp/probe6_body.txt') as f:
        d = json.load(f)
    if isinstance(d, list):
        print(f'Array of {len(d)} items. First item keys: {list(d[0].keys()) if d else \"empty\"}')
    elif isinstance(d, dict):
        print(f'Object keys: {list(d.keys())}')
except Exception as e:
    print(f'JSON parse error: {e}')
" 2>/dev/null
    # Try CSV
    elif echo "$FIRST_BYTES" | grep -qP '[\t,;]'; then
      echo "Content looks like CSV/TSV. First 5 lines:"
      head -5 /tmp/probe6_body.txt
    # Likely HTML
    elif echo "$FIRST_BYTES" | grep -qi '<html\|<!doctype'; then
      echo "Content is HTML (not machine-readable directly)"
    fi
  elif [[ "$HTTP_CODE" == "302" ]] || [[ "$HTTP_CODE" == "301" ]]; then
    LOCATION=$(curl -sI --max-time 10 "$URL" | grep -i location | head -1)
    echo "Redirect to: $LOCATION"
  fi
}

# ---------------------------------------------------------------------------
# Section A: AMFI consolidated portfolio
# ---------------------------------------------------------------------------
hr
echo "SECTION A: AMFI CONSOLIDATED PORTFOLIO DISCLOSURE"
echo "SEBI Regulation 59 requires all AMCs to submit monthly portfolios to AMFI."
echo "Testing multiple possible URLs — AMFI has changed their portal structure."

fetch_check \
  "https://www.amfiindia.com/modules/PortfolioAllAMCs" \
  "Consolidated portfolio (all AMCs) — primary candidate URL"

sleep 1

fetch_check \
  "https://www.amfiindia.com/downloadPortfolioAllAMCs" \
  "Alt: download endpoint variant"

sleep 1

fetch_check \
  "https://www.amfiindia.com/modules/PortfolioAllAMCsDownload" \
  "Alt: download variant 2"

sleep 1

# Try with month/year parameters (AMFI uses yyyymm format in some endpoints)
LAST_MONTH=$(python3 -c "
from datetime import date, timedelta
d = date.today().replace(day=1) - timedelta(days=1)
print(d.strftime('%b-%Y'))  # e.g. Mar-2026
")
LAST_MONTH_NUM=$(python3 -c "
from datetime import date, timedelta
d = date.today().replace(day=1) - timedelta(days=1)
print(d.strftime('%Y%m'))  # e.g. 202603
")
echo ""
echo "Last month: $LAST_MONTH ($LAST_MONTH_NUM)"

fetch_check \
  "https://www.amfiindia.com/modules/PortfolioAllAMCs?mf_id=0&month=${LAST_MONTH}" \
  "Consolidated portfolio with month param"

sleep 1

# ---------------------------------------------------------------------------
# Section B: AMFI biannual stock categorisation list
# ---------------------------------------------------------------------------
hr
echo "SECTION B: AMFI BIANNUAL STOCK CATEGORISATION LIST"
echo "SEBI Circular SEBI/HO/IMD/DF3/CIR/P/2017/114 — published Jan and Jul each year."
echo "Contains: ISIN, company name, market cap category (Large/Mid/Small)."

fetch_check \
  "https://www.amfiindia.com/modules/LoadDownloadMasterData" \
  "Stock categorisation list — primary candidate"

sleep 1

# Try the direct CSV download used in some AMC tools
fetch_check \
  "https://www.amfiindia.com/net-asset-value/cap-categorization-of-stocks" \
  "Alt: cap categorization page"

sleep 1

fetch_check \
  "https://www.amfiindia.com/research-information/other-data/categorization-of-stocks" \
  "Alt: categorization page v2"

sleep 1

# ---------------------------------------------------------------------------
# Section C: AMFI NAV master file (known to work — baseline check)
# ---------------------------------------------------------------------------
hr
echo "SECTION C: AMFI NAV MASTER (BASELINE — known to be machine-readable)"
echo "This is a well-known working endpoint. Checking it confirms the environment"
echo "can reach amfiindia.com at all, and shows the format AMFI uses for CSV data."

fetch_check \
  "https://www.amfiindia.com/spages/NAVAll.txt" \
  "NAV master file — baseline connectivity check"

hr
echo "DONE. Key questions:"
echo "  1. Did any /PortfolioAllAMCs URL return a machine-readable response (not HTML)?"
echo "  2. What format is the consolidated portfolio — CSV, JSON, XML, or HTML?"
echo "  3. Did the stock categorisation list return a parseable CSV?"
echo "  4. If the NAV master worked but portfolio URLs failed, AMFI likely requires"
echo "     form-based POST or session authentication for portfolio data."
