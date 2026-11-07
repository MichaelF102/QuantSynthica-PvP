"""Shared, pure helpers for the data pipeline (fetch_data.py, build_index.py).

Nothing here touches the network. Everything is unit-tested in scripts/tests/.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

import numpy as np
import pandas as pd

CANDLE_COLUMNS = ["time", "open", "high", "low", "close", "volume"]

# Plan decision D4: lot step per asset class, with per-symbol overrides.
LOT_STEP_BY_CLASS = {"futures": 0.01, "index": 0.01, "forex": 1.0, "stock": 1.0, "crypto": 0.0001}
LOT_STEP_OVERRIDES: dict[str, float] = {"6E=F": 1.0}  # Euro FX futures: whole euros
# Display decimals where the asset-class default is wrong (6E ticks in 0.00005).
PRICE_DECIMALS_OVERRIDES: dict[str, int] = {"6E=F": 5}

# Futures are not in any of the supplied metadata lists.
FUTURES_NAMES = {
    "NQ=F": "Nasdaq 100 E-mini Futures",
    "6E=F": "Euro FX Futures (EUR/USD)",
    "ES=F": "S&P 500 E-mini Futures",
    "YM=F": "Dow Jones E-mini Futures",
    "RTY=F": "Russell 2000 E-mini Futures",
    "GC=F": "Gold Futures",
    "CL=F": "Crude Oil Futures",
}

INTERVAL_SECONDS = {"1m": 60, "2m": 120, "5m": 300, "15m": 900, "30m": 1800, "60m": 3600, "1h": 3600, "1d": 86400}


def safe_symbol(symbol: str) -> str:
    """Filename-safe symbol: ^ = . / become _ (CLAUDE.md §8)."""
    return re.sub(r"[\^=./]", "_", symbol)


def asset_class(symbol: str, index_symbols: set[str] | None = None) -> str:
    if index_symbols and symbol in index_symbols:
        return "index"
    if symbol.endswith("=F"):
        return "futures"
    if symbol.endswith("=X"):
        return "forex"
    if symbol.startswith("^"):
        return "index"
    if re.fullmatch(r"[A-Z0-9]+-(USD|USDT|EUR|INR)", symbol):
        return "crypto"
    return "stock"


def currency_for(symbol: str, inr_indices: set[str] | None = None) -> str:
    """Quote currency of a Yahoo symbol. The mapping lives here, never in the UI (CLAUDE.md §8)."""
    if symbol.endswith(".NS") or symbol.endswith(".BO"):
        return "INR"
    if symbol.endswith("=X"):
        base = symbol[:-2]
        if len(base) == 6:  # EURUSD=X -> USD
            return base[3:]
        if len(base) == 3:  # JPY=X is USD/JPY -> JPY
            return base
        raise ValueError(f"unrecognised forex symbol: {symbol}")
    if symbol.startswith("^"):
        if (inr_indices and symbol in inr_indices) or symbol.startswith(("^NSE", "^BSE", "^CNX")):
            return "INR"
        return "USD"
    m = re.fullmatch(r"[A-Z0-9]+-([A-Z]{3,4})", symbol)
    if m:
        return m.group(1)
    return "USD"  # =F futures and plain US tickers


def lot_step_for(symbol: str, cls: str) -> float:
    return LOT_STEP_OVERRIDES.get(symbol, LOT_STEP_BY_CLASS[cls])


def price_decimals_for(symbol: str, cls: str, currency: str) -> int:
    if symbol in PRICE_DECIMALS_OVERRIDES:
        return PRICE_DECIMALS_OVERRIDES[symbol]
    if cls == "forex":
        return 3 if currency == "JPY" else 5
    return 2


def to_candles(raw: pd.DataFrame, symbol: str | None = None) -> pd.DataFrame:
    """Normalise a yfinance download into CANDLE_COLUMNS with time as UNIX seconds UTC."""
    if raw is None or raw.empty:
        return pd.DataFrame(columns=CANDLE_COLUMNS)
    df = raw.copy()
    if isinstance(df.columns, pd.MultiIndex):
        if symbol is not None and symbol in df.columns.get_level_values(-1):
            df = df.xs(symbol, axis=1, level=-1)
        else:
            df.columns = df.columns.get_level_values(0)
    df.columns = [str(c).lower() for c in df.columns]
    missing = {"open", "high", "low", "close"} - set(df.columns)
    if missing:
        raise ValueError(f"download is missing columns: {sorted(missing)}")
    if "volume" not in df.columns:
        df["volume"] = 0

    idx = pd.DatetimeIndex(df.index)
    idx = idx.tz_localize("UTC") if idx.tz is None else idx.tz_convert("UTC")
    # pandas 3 may use us/ns resolution; convert explicitly to whole seconds.
    seconds = (idx - pd.Timestamp(0, tz="UTC")) // pd.Timedelta(seconds=1)
    out = pd.DataFrame(
        {
            "time": seconds.astype("int64"),
            "open": df["open"].to_numpy(dtype="float64"),
            "high": df["high"].to_numpy(dtype="float64"),
            "low": df["low"].to_numpy(dtype="float64"),
            "close": df["close"].to_numpy(dtype="float64"),
            "volume": pd.to_numeric(df["volume"], errors="coerce").to_numpy(dtype="float64"),
        }
    )
    return out


def clean_candles(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    """Drop NaN OHLC and inconsistent bars, fill missing volume with 0, sort, de-duplicate.

    Returns the cleaned frame and counts of what was removed.
    """
    stats = {"nan": 0, "inconsistent": 0, "duplicates": 0}
    if df.empty:
        return df.reindex(columns=CANDLE_COLUMNS), stats
    df = df.copy()
    ohlc = ["open", "high", "low", "close"]
    nan_mask = ~np.isfinite(df[ohlc].to_numpy(dtype="float64")).all(axis=1)
    stats["nan"] = int(nan_mask.sum())
    df = df[~nan_mask]

    df["volume"] = df["volume"].fillna(0).clip(lower=0)
    bad = (df["high"] < df[["open", "close"]].max(axis=1)) | (df["low"] > df[["open", "close"]].min(axis=1)) | (df["low"] <= 0)
    stats["inconsistent"] = int(bad.sum())
    df = df[~bad]

    df = df.sort_values("time", kind="stable")
    before = len(df)
    df = df.drop_duplicates(subset="time", keep="last")
    stats["duplicates"] = before - len(df)

    df["time"] = df["time"].astype("int64")
    df["volume"] = df["volume"].round().astype("int64")
    return df.reset_index(drop=True)[CANDLE_COLUMNS], stats


def merge_candles(existing: pd.DataFrame, new: pd.DataFrame) -> pd.DataFrame:
    """Union two candle frames; rows from `new` win on duplicate timestamps (plan decision D7)."""
    if existing is None or existing.empty:
        merged = new
    elif new is None or new.empty:
        merged = existing
    else:
        merged = pd.concat([existing, new], ignore_index=True)
    merged = merged.sort_values("time", kind="stable").drop_duplicates(subset="time", keep="last")
    return merged.reset_index(drop=True)[CANDLE_COLUMNS]


def find_gaps(times: pd.Series, interval_seconds: int, factor: float = 2.0) -> list[tuple[int, int, int]]:
    """Gaps larger than factor x interval, as (from_time, to_time, gap_seconds), largest first."""
    if len(times) < 2:
        return []
    t = times.to_numpy()
    diffs = t[1:] - t[:-1]
    idx = (diffs > interval_seconds * factor).nonzero()[0]
    gaps = [(int(t[i]), int(t[i + 1]), int(diffs[i])) for i in idx]
    return sorted(gaps, key=lambda g: g[2], reverse=True)


def storage_decimals(symbol: str) -> int:
    """Decimals kept on disk. The source sends float32 values (22678.550781 for 22678.55), so
    non-forex prices are stored at display precision; forex keeps 6 (one past the pip fraction)."""
    cls = asset_class(symbol)
    return 6 if cls == "forex" else max(2, price_decimals_for(symbol, cls, currency_for(symbol)))


def round_prices(df: pd.DataFrame, decimals: int = 6) -> pd.DataFrame:
    """Trim float noise from the source (e.g. 1.1185999870300293 -> 1.118600)."""
    df = df.copy()
    df[["open", "high", "low", "close"]] = df[["open", "high", "low", "close"]].round(decimals)
    return df


def write_atomic_text(path: Path, text: str) -> None:
    """Write to *.tmp then rename, so a crash never leaves a partial file (CLAUDE.md §8)."""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def write_candles_atomic(df: pd.DataFrame, path: Path) -> None:
    write_atomic_text(path, df[CANDLE_COLUMNS].to_csv(index=False, lineterminator="\n"))


def read_candles(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame(columns=CANDLE_COLUMNS)
    df = pd.read_csv(path)
    if list(df.columns) != CANDLE_COLUMNS:
        raise ValueError(f"{path} has columns {list(df.columns)}, expected {CANDLE_COLUMNS}")
    return df
