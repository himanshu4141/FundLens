import pytest
from api._cdsl_nsdl_parser import normalise_cdsl_tx_type


@pytest.mark.parametrize("description,expected", [
    # English — purchase variants
    ("Purchase", "PURCHASE"),
    ("purchase", "PURCHASE"),
    ("PURCHASE", "PURCHASE"),
    ("Buy", "PURCHASE"),
    ("BUY", "PURCHASE"),
    ("NFO Purchase", "PURCHASE"),
    ("SIP", "PURCHASE"),
    ("SIP Installment", "PURCHASE"),
    # English — redemption variants
    ("Redemption", "REDEMPTION"),
    ("REDEMPTION", "REDEMPTION"),
    ("Redeem", "REDEMPTION"),
    ("Full Withdrawal", "REDEMPTION"),
    # English — switch
    ("Switch In", "SWITCH_IN"),
    ("switch in transfer", "SWITCH_IN"),
    ("Switch Out", "SWITCH_OUT"),
    ("Switch Out Transfer", "SWITCH_OUT"),
    # English — dividend
    ("Dividend Reinvest", "DIVIDEND_REINVEST"),
    ("Dividend Reinvestment", "DIVIDEND_REINVEST"),
    ("Dividend Payout", "DIVIDEND"),
    ("Dividend", "DIVIDEND"),
    # Hindi — purchase
    ("खरीद", "PURCHASE"),
    ("नई खरीद", "PURCHASE"),
    # Hindi — redemption
    ("मोचन", "REDEMPTION"),
    ("पूर्ण मोचन", "REDEMPTION"),
    # Hindi — switch
    ("स्विच इन", "SWITCH_IN"),
    ("स्विच आउट", "SWITCH_OUT"),
    # Hindi — dividend
    ("लाभांश पुनर्निवेश", "DIVIDEND_REINVEST"),
    ("लाभांश", "DIVIDEND"),
])
def test_normalise_cdsl_tx_type(description, expected):
    assert normalise_cdsl_tx_type(description) == expected


@pytest.mark.parametrize("description", [
    "",
    None,
    "stamp duty",
    "TDS",
    "STT",
    "miscellaneous",
    "unknown",
])
def test_normalise_cdsl_tx_type_returns_none(description):
    assert normalise_cdsl_tx_type(description) is None
