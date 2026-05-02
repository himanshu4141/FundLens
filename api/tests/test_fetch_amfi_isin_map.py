"""Tests for fetch_amfi_isin_map() using mocked HTTP responses."""

from unittest.mock import MagicMock, patch
import api._cdsl_nsdl_parser as parser_module
from api._cdsl_nsdl_parser import fetch_amfi_isin_map


SAMPLE_NAVALL = """\
Open Ended Schemes(Equity Scheme - Multi Cap Fund)
;
Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
119551;INF846K01DP8;INF846K01VD5;Axis Bluechip Fund - Direct Growth;85.1200;01-May-2024

Open Ended Schemes(Debt Scheme - Liquid Fund)
;
Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
120465;INF179K01VK5;INF179K01VL3;Aditya Birla SL Liquid Fund - Direct Growth;382.5100;01-May-2024
"""


def _make_mock_urlopen(text: str):
    mock_resp = MagicMock()
    mock_resp.read.return_value = text.encode("utf-8")
    mock_resp.__enter__ = lambda s: s
    mock_resp.__exit__ = MagicMock(return_value=False)
    return mock_resp


def test_fetch_amfi_isin_map_returns_correct_mapping():
    parser_module._isin_cache = None  # clear cache before test

    mock_resp = _make_mock_urlopen(SAMPLE_NAVALL)
    with patch("urllib.request.urlopen", return_value=mock_resp):
        result = fetch_amfi_isin_map()

    assert "INF846K01DP8" in result
    code, cat, name = result["INF846K01DP8"]
    assert (code, cat) == (119551, "Equity")
    assert "Axis Bluechip" in name

    assert "INF846K01VD5" in result
    assert result["INF846K01VD5"][:2] == (119551, "Equity")

    assert "INF179K01VK5" in result
    assert result["INF179K01VK5"][:2] == (120465, "Debt")

    assert "INF179K01VL3" in result
    assert result["INF179K01VL3"][:2] == (120465, "Debt")


def test_fetch_amfi_isin_map_uses_cache():
    sentinel = {"INF999X01ZZ0": (999999, "Equity")}
    parser_module._isin_cache = sentinel

    with patch("urllib.request.urlopen") as mock_urlopen:
        result = fetch_amfi_isin_map()
        mock_urlopen.assert_not_called()

    assert result is sentinel
    parser_module._isin_cache = None  # restore


def test_fetch_amfi_isin_map_handles_network_error():
    parser_module._isin_cache = None

    with patch("urllib.request.urlopen", side_effect=OSError("network error")):
        result = fetch_amfi_isin_map()

    assert result == {}
    parser_module._isin_cache = None  # restore
