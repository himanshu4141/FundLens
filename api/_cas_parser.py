from __future__ import annotations

import io
import logging
from typing import Any

import casparser
import pdfplumber

from api._cdsl_nsdl_parser import (
    HoldingsOnlyError,
    detect_cdsl_nsdl,
    parse_cdsl_nsdl,
)

logger = logging.getLogger(__name__)


def _to_float(value: Any) -> float | None:
    if value in (None, "", "-"):
        return None
    return float(value)


def _title_scheme_type(value: str | None) -> str | None:
    if not value:
        return None
    upper = value.upper()
    if upper == "EQUITY":
        return "Equity"
    if upper == "DEBT":
        return "Debt"
    if upper == "HYBRID":
        return "Hybrid"
    if upper == "OTHER":
        return "Other"
    return value.title()


def normalize_casparser_result(raw: dict[str, Any]) -> dict[str, Any]:
    mutual_funds: list[dict[str, Any]] = []

    for folio in raw.get("folios", []):
        schemes: list[dict[str, Any]] = []
        for scheme in folio.get("schemes", []):
            transactions = [
                {
                    "date": tx.get("date"),
                    "type": tx.get("type"),
                    "description": tx.get("description"),
                    "amount": _to_float(tx.get("amount")),
                    "units": _to_float(tx.get("units")),
                    "nav": _to_float(tx.get("nav")),
                    "balance": _to_float(tx.get("balance")),
                }
                for tx in scheme.get("transactions", [])
            ]

            valuation = scheme.get("valuation") or {}
            schemes.append(
                {
                    "name": scheme.get("scheme"),
                    "isin": scheme.get("isin"),
                    "type": _title_scheme_type(scheme.get("type")),
                    "units": _to_float(scheme.get("close")),
                    "nav": _to_float(valuation.get("nav")),
                    "value": _to_float(valuation.get("value")),
                    "additional_info": {
                        "amfi": scheme.get("amfi"),
                        "rta_code": scheme.get("rta_code"),
                        "advisor": scheme.get("advisor"),
                        "open_units": _to_float(scheme.get("open")),
                        "close_units": _to_float(scheme.get("close")),
                    },
                    "transactions": transactions,
                }
            )

        mutual_funds.append(
            {
                "folio_number": folio.get("folio"),
                "amc": folio.get("amc"),
                "schemes": schemes,
            }
        )

    return {"mutual_funds": mutual_funds}


def parse_cas_pdf_bytes(
    pdf_bytes: bytes,
    password: str,
    cdsl_password: str | None = None,
) -> dict[str, Any]:
    """Parse a CAS PDF, auto-detecting whether it is CAMS/KFintech or CDSL/NSDL.

    Strategy:
    1. Try to open with `password` (PAN).  Extract first-page text.
       If open fails AND cdsl_password provided → try cdsl_password.
    2. Scan first-page text for "CDSL"/"NSDL" markers.
       Matching → route to CDSL/NSDL parser.
       Not matching → route to casparser (CAMS/KFintech/MFCentral).
    """
    working_password: str | None = None
    first_page_text = ""

    # Try PAN password first
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes), password=password) as pdf:
            first_page_text = pdf.pages[0].extract_text() or "" if pdf.pages else ""
        working_password = password
    except Exception:
        pass

    # Fall back to CDSL password if PAN open failed
    if working_password is None and cdsl_password:
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes), password=cdsl_password) as pdf:
                first_page_text = pdf.pages[0].extract_text() or "" if pdf.pages else ""
            working_password = cdsl_password
        except Exception:
            pass

    if working_password is None:
        raise Exception(
            "Wrong PDF password. "
            "For CAMS/KFintech/MFCentral PDFs your PAN is the password. "
            "For CDSL/NSDL PDFs the password is your PAN + date of birth (DDMMYYYY). "
            "Make sure both are saved in Settings → Account."
        )

    cas_type = detect_cdsl_nsdl(first_page_text)
    logger.info("[cas-parser] detected cas_type=%s, password_source=%s", cas_type, "pan" if working_password == password else "cdsl")

    if cas_type in ("cdsl", "nsdl"):
        return parse_cdsl_nsdl(pdf_bytes, working_password)

    # CAMS / KFintech / MFCentral path — use casparser with the PAN password
    raw = casparser.read_cas_pdf(io.BytesIO(pdf_bytes), password, output="dict")

    if hasattr(raw, "model_dump"):
        raw = raw.model_dump(mode="json")

    return normalize_casparser_result(raw)
