"""CDSL / NSDL CAS PDF parser.

Produces the same { "mutual_funds": [...] } shape as normalize_casparser_result()
so importCASData() in the TypeScript edge function needs zero changes.

Key design decisions:
- ISINs (INF[A-Z0-9]{9}) are always ASCII regardless of PDF language — used as
  the primary anchor for every scheme block.
- pdfplumber's position-based table extraction is language-agnostic; column
  values (amounts, units, NAV) are always ASCII numerals.
- "CDSL" and "NSDL" are acronyms that always appear as ASCII — used for detection.
- Dates and transaction descriptions may appear in Hindi (Devanagari) — handled
  via explicit mapping tables with re.UNICODE patterns.
"""

from __future__ import annotations

import io
import logging
import re
import urllib.request
from typing import Any

import pdfplumber

logger = logging.getLogger(__name__)

# ── AMFI ISIN → scheme_code cache ─────────────────────────────────────────────

_isin_cache: dict[str, tuple[int, str]] | None = None

AMFI_NAV_URL = "https://www.amfiindia.com/spages/NAVAll.txt"

# Map AMFI broad-category prefixes → our scheme type labels
_CATEGORY_MAP = [
    ("equity", "Equity"),
    ("debt", "Debt"),
    ("hybrid", "Hybrid"),
    ("solution", "Hybrid"),
    ("other", "Other"),
    ("fund of fund", "Other"),
    ("index fund", "Equity"),
    ("etf", "Equity"),
]


def _broad_category(header: str) -> str:
    low = header.lower()
    for keyword, label in _CATEGORY_MAP:
        if keyword in low:
            return label
    return "Other"


def fetch_amfi_isin_map() -> dict[str, tuple[int, str]]:
    """Return { isin: (scheme_code, broad_category) } for all MF ISINs.

    Result is cached module-level so warm Vercel invocations skip the network
    round-trip.
    """
    global _isin_cache
    if _isin_cache is not None:
        return _isin_cache

    logger.info("[cdsl-parser] fetching AMFI ISIN map from %s", AMFI_NAV_URL)
    try:
        with urllib.request.urlopen(AMFI_NAV_URL, timeout=15) as resp:
            text = resp.read().decode("utf-8", errors="replace")
    except Exception as exc:
        logger.error("[cdsl-parser] AMFI fetch failed: %s", exc)
        _isin_cache = {}
        return _isin_cache

    result: dict[str, tuple[int, str]] = {}
    current_category = "Other"

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue

        # Section header lines contain no semicolons and look like
        # "Equity Scheme - Multi Cap Fund"
        if ";" not in line:
            current_category = _broad_category(line)
            continue

        parts = line.split(";")
        if len(parts) < 6:
            continue

        # NAVAll.txt columns:
        # scheme_code;ISIN_growth;ISIN_div_reinvest;scheme_name;nav_date;nav
        try:
            code = int(parts[0].strip())
        except ValueError:
            continue

        for col in (1, 2):
            isin = parts[col].strip()
            if re.match(r"^INF[A-Z0-9]{9}$", isin):
                result[isin] = (code, current_category)

    logger.info("[cdsl-parser] AMFI map loaded: %d ISINs", len(result))
    _isin_cache = result
    return result


# ── Detection ──────────────────────────────────────────────────────────────────

def detect_cdsl_nsdl(raw_text: str) -> str | None:
    """Return 'cdsl', 'nsdl', or None.

    Checks first ~3000 chars for the ASCII acronyms CDSL / NSDL.
    Language-agnostic: the acronyms are always ASCII regardless of PDF language.
    """
    snippet = raw_text[:3000]
    if "CDSL" in snippet:
        return "cdsl"
    if "NSDL" in snippet:
        return "nsdl"
    return None


# ── Date parsing ───────────────────────────────────────────────────────────────

MONTH_MAP: dict[str, str] = {
    # English (3-letter abbreviations)
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
    # Hindi full month names (Devanagari)
    "जनवरी": "01",
    "फरवरी": "02",
    "मार्च": "03",
    "अप्रैल": "04",
    "मई": "05",
    "जून": "06",
    "जुलाई": "07",
    "अगस्त": "08",
    "सितंबर": "09",
    "अक्तूबर": "10",
    "अक्टूबर": "10",
    "नवंबर": "11",
    "दिसंबर": "12",
}

_DATE_RE = re.compile(
    r"^(\d{1,2})[/\-]([A-Za-zऀ-ॿ]+)[/\-](\d{4})$",
    re.UNICODE,
)


def parse_date_cdsl(raw: str) -> str:
    """Parse DD-Mon-YYYY or DD-HindiMonth-YYYY → ISO YYYY-MM-DD."""
    if not raw:
        return ""
    raw = raw.strip()
    # Already ISO
    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
        return raw
    m = _DATE_RE.match(raw)
    if m:
        dd, mon_raw, yyyy = m.group(1), m.group(2), m.group(3)
        key = mon_raw.lower()
        mm = MONTH_MAP.get(key) or MONTH_MAP.get(mon_raw)
        if mm:
            return f"{yyyy}-{mm}-{dd.zfill(2)}"
    logger.warning("[cdsl-parser] unrecognised date: %r", raw)
    return raw


# ── Transaction type normalisation ─────────────────────────────────────────────

TX_KEYWORDS: list[tuple[str, str]] = [
    (r"खरीद|purchase|buy|nfo|sip", "PURCHASE"),
    (r"मोचन|redemption|redeem|withdrawal", "REDEMPTION"),
    (r"स्विच.*इन|switch.*in", "SWITCH_IN"),
    (r"स्विच.*आउट|switch.*out", "SWITCH_OUT"),
    (r"लाभांश.*पुनर्निवेश|dividend.*reinvest", "DIVIDEND_REINVEST"),
    (r"लाभांश|dividend", "DIVIDEND"),
]

_TX_COMPILED = [(re.compile(pat, re.IGNORECASE | re.UNICODE), typ) for pat, typ in TX_KEYWORDS]


def normalise_cdsl_tx_type(description: str) -> str | None:
    """Map an English or Hindi transaction description to an uppercase type string.

    Returns None for unrecognised descriptions (caller skips the row).
    """
    if not description:
        return None
    for pattern, tx_type in _TX_COMPILED:
        if pattern.search(description):
            return tx_type
    return None


# ── ISIN helpers ───────────────────────────────────────────────────────────────

_ISIN_RE = re.compile(r"\bINF[A-Z0-9]{9}\b")

_FLOAT_RE = re.compile(r"^-?[\d,]+\.?\d*$")


def _parse_float(val: Any) -> float | None:
    if val is None:
        return None
    s = str(val).strip().replace(",", "")
    if not s or s == "-":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _cell_is_isin(cell: Any) -> bool:
    return bool(cell and _ISIN_RE.match(str(cell).strip()))


def _find_isin_col(rows: list[list]) -> int | None:
    for row in rows:
        for i, cell in enumerate(row):
            if _cell_is_isin(cell):
                return i
    return None


# ── Core extraction ────────────────────────────────────────────────────────────

def _extract_tables_with_isin(pdf: pdfplumber.PDF) -> list[list[list]]:
    """Return all pdfplumber tables that contain at least one MF ISIN cell."""
    result = []
    for page in pdf.pages:
        for table in page.extract_tables():
            for row in table:
                if any(_cell_is_isin(cell) for cell in (row or [])):
                    result.append(table)
                    break
    return result


def _guess_col_indices(rows: list[list], isin_col: int) -> dict[str, int | None]:
    """Heuristically identify which column index holds which value.

    We look for columns that:
    - units/nav/value: mostly numeric float values
    - date: mostly match DD-Mon-YYYY or ISO date patterns
    - description: mostly text / Hindi text
    """
    if not rows:
        return {}

    ncols = max(len(r) for r in rows)

    float_scores = [0] * ncols
    date_scores = [0] * ncols
    text_scores = [0] * ncols

    _date_hint = re.compile(
        r"\d{1,2}[/\-]([A-Za-zऀ-ॿ]{3,})[/\-]\d{4}", re.UNICODE
    )

    for row in rows:
        for i, cell in enumerate(row):
            if i >= ncols or cell is None:
                continue
            s = str(cell).strip().replace(",", "")
            if not s or s == "-":
                continue
            if _date_hint.search(str(cell)):
                date_scores[i] += 1
            elif _FLOAT_RE.match(s):
                float_scores[i] += 1
            elif len(s) > 3:
                text_scores[i] += 1

    # units, nav, amount: top 3 numeric cols excluding isin_col
    numeric_cols = sorted(
        [i for i in range(ncols) if i != isin_col and float_scores[i] > 0],
        key=lambda i: -float_scores[i],
    )

    date_col = max(
        (i for i in range(ncols) if date_scores[i] > 0),
        key=lambda i: date_scores[i],
        default=None,
    )
    desc_col = max(
        (i for i in range(ncols) if i not in (isin_col, date_col) and text_scores[i] > 0),
        key=lambda i: text_scores[i],
        default=None,
    )

    # Among numeric cols: units (smaller fractional numbers), nav (medium), amount (large)
    units_col = numeric_cols[0] if len(numeric_cols) > 0 else None
    nav_col = numeric_cols[1] if len(numeric_cols) > 1 else None
    amount_col = numeric_cols[2] if len(numeric_cols) > 2 else None

    return {
        "date": date_col,
        "desc": desc_col,
        "units": units_col,
        "nav": nav_col,
        "amount": amount_col,
    }


def extract_mf_folios(
    pdf: pdfplumber.PDF,
    isin_map: dict[str, tuple[int, str]],
) -> list[dict[str, Any]]:
    """Extract mutual fund folio data from a CDSL/NSDL CAS PDF.

    Uses two passes over pdfplumber tables:
    1. Holdings pass: finds ISIN + numeric columns → scheme metadata
    2. Transaction pass: finds date + description + numeric columns near each ISIN
    """
    tables = _extract_tables_with_isin(pdf)
    if not tables:
        return []

    # We build a flat list of scheme dicts keyed by ISIN, then group by folio.
    # folio_number is extracted from text near the ISIN block when possible.
    schemes_by_isin: dict[str, dict[str, Any]] = {}
    folio_by_isin: dict[str, str] = {}

    _folio_re = re.compile(r"(?:folio|foliono|folio\s*no\.?)[:\s]*([A-Z0-9/]+)", re.IGNORECASE)

    for table in tables:
        # Skip completely empty tables
        data_rows = [r for r in table if any(c for c in (r or []) if c)]
        if not data_rows:
            continue

        isin_col = _find_isin_col(data_rows)
        if isin_col is None:
            continue

        cols = _guess_col_indices(data_rows, isin_col)

        current_isin: str | None = None

        for row in data_rows:
            if not row or len(row) <= isin_col:
                continue

            cell_isin = str(row[isin_col] or "").strip()

            # Row with an ISIN → new scheme or holdings row
            if _ISIN_RE.match(cell_isin):
                current_isin = cell_isin

                if current_isin not in isin_map:
                    logger.debug("[cdsl-parser] ISIN %s not in AMFI map — skipping", current_isin)
                    continue

                scheme_code, category = isin_map[current_isin]

                units_val = _parse_float(row[cols["units"]] if cols.get("units") is not None else None)
                nav_val = _parse_float(row[cols["nav"]] if cols.get("nav") is not None else None)
                amount_val = _parse_float(row[cols["amount"]] if cols.get("amount") is not None else None)

                if current_isin not in schemes_by_isin:
                    schemes_by_isin[current_isin] = {
                        "name": None,
                        "isin": current_isin,
                        "type": category,
                        "units": units_val,
                        "nav": nav_val,
                        "value": amount_val,
                        "additional_info": {
                            "amfi": str(scheme_code),
                            "rta_code": None,
                            "advisor": None,
                            "open_units": None,
                            "close_units": units_val,
                        },
                        "transactions": [],
                        "_scheme_code": scheme_code,
                    }
                else:
                    # Update holdings data if we see it again
                    s = schemes_by_isin[current_isin]
                    if units_val is not None:
                        s["units"] = units_val
                        s["additional_info"]["close_units"] = units_val
                    if nav_val is not None:
                        s["nav"] = nav_val
                    if amount_val is not None:
                        s["value"] = amount_val

                # Try to get a scheme name from an adjacent text cell
                for c_idx, cell in enumerate(row):
                    if c_idx == isin_col:
                        continue
                    cell_str = str(cell or "").strip()
                    if len(cell_str) > 10 and not _FLOAT_RE.match(cell_str.replace(",", "")):
                        schemes_by_isin[current_isin]["name"] = cell_str
                        break

                # Try to find folio number in any cell of this row
                for cell in row:
                    if not cell:
                        continue
                    fm = _folio_re.search(str(cell))
                    if fm:
                        folio_by_isin[current_isin] = fm.group(1)
                        break

                continue

            # Row without an ISIN — might be a transaction row for current_isin
            if current_isin is None or current_isin not in isin_map:
                continue

            date_cell = str(row[cols["date"]] if cols.get("date") is not None and len(row) > (cols.get("date") or 0) else "").strip()
            if not date_cell:
                continue

            parsed_date = parse_date_cdsl(date_cell)
            # If date parsing failed (returned original string that doesn't look like a date)
            if not re.match(r"^\d{4}-\d{2}-\d{2}$", parsed_date):
                continue

            desc_cell = str(row[cols["desc"]] if cols.get("desc") is not None and len(row) > (cols.get("desc") or 0) else "").strip()
            tx_type = normalise_cdsl_tx_type(desc_cell)
            if tx_type is None:
                continue

            units_val = _parse_float(row[cols["units"]] if cols.get("units") is not None and len(row) > (cols.get("units") or 0) else None)
            nav_val = _parse_float(row[cols["nav"]] if cols.get("nav") is not None and len(row) > (cols.get("nav") or 0) else None)
            amount_val = _parse_float(row[cols["amount"]] if cols.get("amount") is not None and len(row) > (cols.get("amount") or 0) else None)

            if units_val is None or units_val == 0:
                continue

            schemes_by_isin[current_isin]["transactions"].append({
                "date": parsed_date,
                "type": tx_type,
                "description": desc_cell or tx_type.title(),
                "amount": abs(amount_val) if amount_val is not None else 0.0,
                "units": abs(units_val),
                "nav": nav_val or 0.0,
                "balance": None,
            })

    if not schemes_by_isin:
        return []

    # Group schemes by folio number
    folio_schemes: dict[str, list[dict[str, Any]]] = {}
    for isin, scheme in schemes_by_isin.items():
        folio_num = folio_by_isin.get(isin, "CDSL")
        folio_schemes.setdefault(folio_num, []).append(scheme)

    return [
        {
            "folio_number": folio_num,
            "amc": None,
            "schemes": [
                {k: v for k, v in s.items() if k != "_scheme_code"}
                for s in schemes
            ],
        }
        for folio_num, schemes in folio_schemes.items()
    ]


# ── Custom exceptions ──────────────────────────────────────────────────────────

class HoldingsOnlyError(ValueError):
    """Raised when the CDSL/NSDL CAS contains no transaction history."""


# ── Public entry point ─────────────────────────────────────────────────────────

def parse_cdsl_nsdl(pdf_bytes: bytes, password: str) -> dict[str, Any]:
    """Parse a CDSL or NSDL CAS PDF and return a CASParseResult-compatible dict.

    Raises:
        ValueError: If the PDF is not a CDSL/NSDL statement.
        HoldingsOnlyError: If the statement has no transaction history.
        Exception: If the PDF cannot be decrypted (wrong password).
    """
    try:
        pdf = pdfplumber.open(io.BytesIO(pdf_bytes), password=password)
    except Exception as exc:
        raise Exception(f"Could not open PDF — check your password: {exc}") from exc

    with pdf:
        first_page_text = pdf.pages[0].extract_text() or "" if pdf.pages else ""
        cas_type = detect_cdsl_nsdl(first_page_text)
        if cas_type is None:
            raise ValueError(
                "This PDF does not appear to be a CDSL or NSDL statement. "
                "For CAMS/KFintech/MFCentral PDFs, use the standard upload flow."
            )

        logger.info("[cdsl-parser] detected %s CAS", cas_type.upper())

        isin_map = fetch_amfi_isin_map()
        folios = extract_mf_folios(pdf, isin_map)

    total_transactions = sum(
        len(s.get("transactions", []))
        for f in folios
        for s in f.get("schemes", [])
    )

    if total_transactions == 0:
        raise HoldingsOnlyError(
            "This appears to be a holdings-only statement. Please download a Detailed CAS "
            "from CDSL/NSDL to include your transaction history."
        )

    logger.info(
        "[cdsl-parser] done — folios=%d, transactions=%d",
        len(folios),
        total_transactions,
    )

    return {"mutual_funds": folios}
