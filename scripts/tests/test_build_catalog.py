import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_catalog import build_catalog, in_symbol, us_symbol  # noqa: E402

META = Path(__file__).resolve().parents[2] / "data"


def test_symbol_conversion():
    assert us_symbol("AAPL") == "AAPL"
    assert us_symbol("BRK.B") == "BRK-B"
    assert us_symbol("ABC/WS") is None
    assert in_symbol("RELIANCE", "NSE") == "RELIANCE.NS"
    assert in_symbol("500325", "BSE") == "500325.BO"
    assert in_symbol("M&M", "NSE") == "M&M.NS"
    assert in_symbol("M_M", "BSE") is None  # ambiguous, left out
    assert in_symbol("KRT.RR", "BSE") is None
    assert in_symbol("X", "MCX") is None


def test_catalog_from_real_metadata():
    cat = build_catalog(META)
    by = {r["s"]: r for r in cat}
    assert len(by) == len(cat), "symbols are unique"
    assert by["^GSPC"] == {"s": "^GSPC", "n": "S&P 500", "a": "index", "c": "USD", "e": "S&P DJI"}
    assert by["^NSEI"]["c"] == "INR" and by["^NSEI"]["a"] == "index"
    assert by["RELIANCE.NS"]["c"] == "INR" and by["RELIANCE.NS"]["a"] == "stock"
    assert by["AAPL"]["e"] == "NASDAQ"
    assert by["EURUSD=X"]["a"] == "forex"
    assert by["NQ=F"]["a"] == "futures"
    assert "BRK-B" in by


def test_catalog_has_no_prices_and_no_otc():
    import pandas as pd

    cat = build_catalog(META)
    assert all(set(r) == {"s", "n", "a", "c", "e"} for r in cat)
    assert not any(r["e"] == "OTC" for r in cat)
    us = pd.read_csv(META / "US_Stocks_Data.csv", dtype=str)
    otc_only = set(us.loc[us["Exchange"] == "OTC", "Symbol"]) - set(us.loc[us["Exchange"] != "OTC", "Symbol"])
    assert not (otc_only & {r["s"] for r in cat})


def test_dual_listed_india_keeps_nse_only():
    cat = {r["s"] for r in build_catalog(META)}
    assert "RELIANCE.NS" in cat and "RELIANCE.BO" not in cat


def test_missing_metadata_dir(tmp_path):
    # Only the built-in futures names remain.
    assert {r["a"] for r in build_catalog(tmp_path)} == {"futures"}
