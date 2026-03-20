from __future__ import annotations

from io import BytesIO
from typing import Any

import casparser


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


def parse_cas_pdf_bytes(pdf_bytes: bytes, password: str) -> dict[str, Any]:
    raw = casparser.read_cas_pdf(BytesIO(pdf_bytes), password, output="dict")

    if hasattr(raw, "model_dump"):
        raw = raw.model_dump(mode="json")

    return normalize_casparser_result(raw)
