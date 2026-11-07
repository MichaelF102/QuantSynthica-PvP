"""Unit tests for the pure pipeline helpers. Run: .venv/bin/python -m pytest scripts/tests -q"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from qs_data import (  # noqa: E402
    CANDLE_COLUMNS,
    asset_class,
    clean_candles,
    currency_for,
    find_gaps,
    lot_step_for,
    merge_candles,
    price_decimals_for,
    round_prices,
    safe_symbol,
    storage_decimals,
    to_candles,
    write_atomic_text,
)


@pytest.mark.parametrize("sym,expected", [("^GSPC", "_GSPC"), ("EURUSD=X", "EURUSD_X"), ("RELIANCE.NS", "RELIANCE_NS"), ("BRK/B", "BRK_B"), ("NQ=F", "NQ_F")])
def test_safe_symbol(sym, expected):
    assert safe_symbol(sym) == expected


@pytest.mark.parametrize(
    "sym,cls,cur",
    [
        ("NQ=F", "futures", "USD"),
        ("EURUSD=X", "forex", "USD"),
        ("EURJPY=X", "forex", "JPY"),
        ("JPY=X", "forex", "JPY"),
        ("INR=X", "forex", "INR"),
        ("^GSPC", "index", "USD"),
        ("^NSEI", "index", "INR"),
        ("^BSESN", "index", "INR"),
        ("RELIANCE.NS", "stock", "INR"),
        ("TCS.BO", "stock", "INR"),
        ("AAPL", "stock", "USD"),
        ("BTC-USD", "crypto", "USD"),
    ],
)
def test_asset_class_and_currency(sym, cls, cur):
    assert asset_class(sym) == cls
    assert currency_for(sym) == cur


def test_metadata_overrides_for_indices():
    # BSE indices on the source use a .BO suffix but are indices, quoted in INR.
    assert asset_class("BSE-AUTO.BO", {"BSE-AUTO.BO"}) == "index"
    assert currency_for("^CNXIT", {"^CNXIT"}) == "INR"
    assert currency_for("^NSEBANK") == "INR"


def test_bad_forex_symbol_raises():
    with pytest.raises(ValueError):
        currency_for("EURO=X")


def test_lot_steps_and_decimals():
    assert lot_step_for("NQ=F", "futures") == 0.01
    assert lot_step_for("^NSEI", "index") == 0.01
    assert lot_step_for("EURUSD=X", "forex") == 1.0
    assert lot_step_for("AAPL", "stock") == 1.0
    assert price_decimals_for("EURUSD=X", "forex", "USD") == 5
    assert price_decimals_for("USDJPY=X", "forex", "JPY") == 3
    assert price_decimals_for("NQ=F", "futures", "USD") == 2
    assert storage_decimals("EURUSD=X") == 6
    assert storage_decimals("^NSEI") == 2
    # Euro FX futures override the futures defaults.
    assert lot_step_for("6E=F", "futures") == 1.0
    assert price_decimals_for("6E=F", "futures", "USD") == 5
    assert storage_decimals("6E=F") == 5


def _raw(times, ohlc, volume=None, multi=True):
    idx = pd.DatetimeIndex(pd.to_datetime(times)).tz_localize("America/New_York")
    data = {"Open": [r[0] for r in ohlc], "High": [r[1] for r in ohlc], "Low": [r[2] for r in ohlc], "Close": [r[3] for r in ohlc]}
    if volume is not None:
        data["Volume"] = volume
    df = pd.DataFrame(data, index=idx)
    if multi:
        df.columns = pd.MultiIndex.from_product([df.columns, ["NQ=F"]])
    return df


def test_to_candles_converts_timezone_to_unix_seconds_and_flattens_columns():
    raw = _raw(["2026-11-03 09:30"], [(1, 2, 0.5, 1.5)], [10])
    out = to_candles(raw, "NQ=F")
    assert list(out.columns) == CANDLE_COLUMNS
    # 09:30 New York (EST, UTC-5) on 2026-11-03 is 14:30 UTC.
    assert out["time"].iloc[0] == int(pd.Timestamp("2026-11-03 14:30", tz="UTC").timestamp())


def test_to_candles_handles_microsecond_resolution_index():
    raw = _raw(["2026-11-03 09:30"], [(1, 2, 0.5, 1.5)], [10])
    raw.index = raw.index.as_unit("us")
    assert to_candles(raw, "NQ=F")["time"].iloc[0] == int(pd.Timestamp("2026-11-03 14:30", tz="UTC").timestamp())


def test_to_candles_adds_missing_volume_and_handles_empty():
    out = to_candles(_raw(["2026-11-03 09:30"], [(1, 2, 0.5, 1.5)], multi=False))
    assert out["volume"].iloc[0] == 0
    assert to_candles(pd.DataFrame()).empty


def _frame(rows):
    return pd.DataFrame(rows, columns=CANDLE_COLUMNS)


def test_clean_drops_nan_inf_inconsistent_and_duplicates_and_sorts():
    df = _frame(
        [
            [180, 1, 2, 0.5, 1.5, 3],
            [60, 1, 2, 0.5, 1.5, np.nan],  # missing volume -> 0
            [120, np.nan, 2, 0.5, 1.5, 1],  # NaN OHLC -> dropped
            [240, 1, np.inf, 0.5, 1.5, 1],  # inf -> dropped
            [300, 1, 1.2, 0.5, 1.5, 1],  # high below close -> dropped
            [180, 1, 2, 0.5, 1.6, 4],  # duplicate time -> last kept
        ]
    )
    out, stats = clean_candles(df)
    assert out["time"].tolist() == [60, 180]
    assert out["volume"].tolist() == [0, 4]
    assert out["close"].tolist() == [1.5, 1.6]
    assert stats == {"nan": 2, "inconsistent": 1, "duplicates": 1}


def test_merge_prefers_new_rows_and_sorts():
    old = _frame([[60, 1, 1, 1, 1, 0], [120, 1, 1, 1, 1, 0]])
    new = _frame([[120, 2, 2, 2, 2, 5], [180, 3, 3, 3, 3, 0]])
    out = merge_candles(old, new)
    assert out["time"].tolist() == [60, 120, 180]
    assert out.loc[out["time"] == 120, "close"].item() == 2
    assert merge_candles(_frame([]), new)["time"].tolist() == [120, 180]


def test_find_gaps_largest_first():
    times = pd.Series([0, 60, 120, 600, 660, 7860])
    assert find_gaps(times, 60) == [(660, 7860, 7200), (120, 600, 480)]
    assert find_gaps(pd.Series([0]), 60) == []


def test_round_prices_trims_float32_noise():
    out = round_prices(_frame([[60, 22678.550781, 22682.550781, 22678.099609, 22680.150391, 0]]), 2)
    assert out.iloc[0, 1:5].tolist() == [22678.55, 22682.55, 22678.1, 22680.15]


def test_write_atomic_leaves_no_tmp(tmp_path):
    target = tmp_path / "x.csv"
    write_atomic_text(target, "a\n")
    assert target.read_text() == "a\n"
    assert not (tmp_path / "x.csv.tmp").exists()
