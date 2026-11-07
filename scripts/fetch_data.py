"""Fetch OHLCV candles from the market-data source into public/data/{SAFE_SYMBOL}.csv.

Run locally (needs internet), from the repo root:
    python scripts/fetch_data.py --symbols NQ=F 6E=F ^GSPC ^NSEI --days 29

- 1m bars only exist for about the last 30 days, and each request may cover at most ~7 days,
  so the range is fetched in chunks.
- New rows are merged into the existing file for the symbol (plan decision D7), so history
  builds up when this is re-run over time.
- Files are written to *.tmp and renamed, never left half-written.
- A sidecar {SAFE_SYMBOL}.meta.json stores the original symbol for build_index.py.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from qs_data import (  # noqa: E402
    INTERVAL_SECONDS,
    clean_candles,
    find_gaps,
    merge_candles,
    read_candles,
    round_prices,
    safe_symbol,
    storage_decimals,
    to_candles,
    write_atomic_text,
    write_candles_atomic,
)

CHUNK_DAYS = {"1m": 7, "2m": 59, "5m": 59, "15m": 59, "30m": 59, "60m": 729, "1h": 729, "1d": 3650}
MAX_LOOKBACK_DAYS = {"1m": 30, "2m": 60, "5m": 60, "15m": 60, "30m": 60, "60m": 730, "1h": 730}


def fmt_ts(t: int) -> str:
    return dt.datetime.fromtimestamp(t, dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def download_range(symbol: str, interval: str, days: int) -> pd.DataFrame:
    import yfinance as yf  # imported here so the helpers and tests don't need it

    now = dt.datetime.now(dt.timezone.utc).replace(second=0, microsecond=0)
    lookback = min(days, MAX_LOOKBACK_DAYS.get(interval, days))
    # Stay a little inside the source's hard limit, which is measured from "now" on its side.
    start = now - dt.timedelta(days=lookback) + dt.timedelta(hours=1)
    step = dt.timedelta(days=CHUNK_DAYS.get(interval, 7))
    frames = []
    while start < now:
        end = min(start + step, now)
        raw = yf.download(symbol, interval=interval, start=start, end=end, auto_adjust=False, progress=False, threads=False)
        part = to_candles(raw, symbol)
        print(f"  chunk {start:%Y-%m-%d} -> {end:%Y-%m-%d}: {len(part)} rows")
        if not part.empty:
            frames.append(part)
        start = end
    return pd.concat(frames, ignore_index=True) if frames else to_candles(pd.DataFrame())


def fetch_symbol(symbol: str, interval: str, days: int, out_dir: Path) -> bool:
    print(f"\n== {symbol} ({interval}, last {days} days)")
    raw = download_range(symbol, interval, days)
    new, dropped = clean_candles(raw)
    if new.empty:
        print(f"  !! no data returned for {symbol}; existing file (if any) left unchanged")
        return False

    safe = safe_symbol(symbol)
    path = out_dir / f"{safe}.csv"
    existing = read_candles(path)
    merged = round_prices(merge_candles(existing, new), storage_decimals(symbol))
    write_candles_atomic(merged, path)
    meta = {"symbol": symbol, "interval": interval, "updatedAt": int(dt.datetime.now(dt.timezone.utc).timestamp())}
    write_atomic_text(out_dir / f"{safe}.meta.json", json.dumps(meta, indent=2) + "\n")

    gaps = find_gaps(merged["time"], INTERVAL_SECONDS[interval])
    print(f"  dropped: {dropped['nan']} NaN, {dropped['inconsistent']} inconsistent, {dropped['duplicates']} duplicate rows")
    print(f"  rows: {len(merged)} (was {len(existing)}, fetched {len(new)})")
    print(f"  range: {fmt_ts(int(merged['time'].iloc[0]))} -> {fmt_ts(int(merged['time'].iloc[-1]))}")
    print(f"  gaps > 2x interval: {len(gaps)}")
    for a, b, secs in gaps[:5]:
        print(f"    {fmt_ts(a)} -> {fmt_ts(b)}  ({secs / 3600:.1f} h)")
    print(f"  wrote {path}")
    return True


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--symbols", nargs="+", required=True)
    p.add_argument("--days", type=int, default=29)
    p.add_argument("--interval", default="1m", choices=sorted(INTERVAL_SECONDS))
    p.add_argument("--out", default="public/data")
    args = p.parse_args(argv)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    failed = []
    for sym in args.symbols:
        try:
            if not fetch_symbol(sym, args.interval, args.days, out_dir):
                failed.append(sym)
        except Exception as exc:  # keep going with the other symbols
            print(f"  !! {sym} failed: {exc}")
            failed.append(sym)
    if failed:
        print(f"\nFailed: {', '.join(failed)}")
        return 1
    print("\nDone. Now run: python scripts/build_index.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
