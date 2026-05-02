import pytest
from api._cdsl_nsdl_parser import parse_date_cdsl


@pytest.mark.parametrize("raw,expected", [
    # English month abbreviations
    ("05-Apr-2024", "2024-04-05"),
    ("01-Jan-2023", "2023-01-01"),
    ("31-Dec-2022", "2022-12-31"),
    ("15-Mar-2021", "2021-03-15"),
    ("28-Feb-2020", "2020-02-28"),
    # English with slash separator
    ("05/Apr/2024", "2024-04-05"),
    # Already ISO
    ("2024-04-05", "2024-04-05"),
    # Hindi month names (Devanagari)
    ("01-अप्रैल-2024", "2024-04-01"),
    ("15-जनवरी-2023", "2023-01-15"),
    ("31-दिसंबर-2022", "2022-12-31"),
    ("10-मार्च-2021", "2021-03-10"),
    ("05-फरवरी-2020", "2020-02-05"),
    ("20-मई-2019", "2019-05-20"),
    ("11-जून-2018", "2018-06-11"),
    ("22-जुलाई-2017", "2017-07-22"),
    ("08-अगस्त-2016", "2016-08-08"),
    ("14-सितंबर-2015", "2015-09-14"),
    ("03-अक्तूबर-2014", "2014-10-03"),
    ("03-अक्टूबर-2014", "2014-10-03"),
    ("17-नवंबर-2013", "2013-11-17"),
    # Single digit day
    ("5-Apr-2024", "2024-04-05"),
    ("5-अप्रैल-2024", "2024-04-05"),
])
def test_parse_date_cdsl(raw, expected):
    assert parse_date_cdsl(raw) == expected


def test_empty_string():
    assert parse_date_cdsl("") == ""


def test_unrecognised_format_returns_raw():
    # Falls back to raw string when format not recognised
    result = parse_date_cdsl("tomorrow")
    assert result == "tomorrow"
