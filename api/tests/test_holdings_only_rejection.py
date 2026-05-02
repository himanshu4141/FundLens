"""Tests that parse_cdsl_nsdl raises HoldingsOnlyError when there are no transactions."""

import io
from unittest.mock import MagicMock, patch

import pytest

import api._cdsl_nsdl_parser as parser_module
from api._cdsl_nsdl_parser import HoldingsOnlyError, parse_cdsl_nsdl


def _make_pdf_mock(first_page_text: str, tables: list):
    """Build a minimal pdfplumber PDF mock."""
    page = MagicMock()
    page.extract_text.return_value = first_page_text
    page.extract_tables.return_value = tables

    pdf = MagicMock()
    pdf.pages = [page]
    pdf.__enter__ = lambda s: s
    pdf.__exit__ = MagicMock(return_value=False)
    return pdf


def test_holdings_only_raises_error():
    """A CDSL CAS with ISINs but zero transactions → HoldingsOnlyError."""
    # Table: ISIN row but no date/description rows following it
    holdings_table = [
        ["ISIN", "Scheme Name", "Units", "NAV", "Value"],
        ["INF846K01VD5", "Axis Bluechip Fund - Direct Growth", "123.456", "85.12", "10527.10"],
    ]

    pdf_mock = _make_pdf_mock(
        "CDSL Consolidated Account Statement\nINF846K01VD5",
        [holdings_table],
    )

    # Patch pdfplumber.open and AMFI map
    isin_map = {"INF846K01VD5": (119551, "Equity")}
    parser_module._isin_cache = isin_map

    with patch("pdfplumber.open", return_value=pdf_mock):
        with pytest.raises(HoldingsOnlyError, match="holdings-only"):
            parse_cdsl_nsdl(b"fake-pdf-bytes", "ABCDE1234F")

    parser_module._isin_cache = None


def test_not_cdsl_raises_value_error():
    """A PDF that decrypts fine but has no CDSL/NSDL marker → ValueError."""
    pdf_mock = _make_pdf_mock(
        "CAMS Consolidated Account Statement — no CDSL/NSDL here",
        [],
    )

    with patch("pdfplumber.open", return_value=pdf_mock):
        with pytest.raises(ValueError, match="does not appear to be a CDSL or NSDL"):
            parse_cdsl_nsdl(b"fake-pdf-bytes", "ABCDE1234F")
