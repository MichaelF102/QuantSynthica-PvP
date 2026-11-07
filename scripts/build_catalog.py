"""Build public/data/catalog.json: the searchable ticker reference for the setup picker.

    python scripts/build_catalog.py [--meta data] [--out public/data/catalog.json]

The catalog is a reference list only: symbol, name, asset class, currency and exchange. It never
carries prices (the metadata files' price columns are snapshots, not candle data, CLAUDE.md §8).
Whether a ticker is playable is decided by index.json, which lists the symbols that have candles.

Rows: {"s": symbol, "n": name, "a": assetClass, "c": currency, "e": exchange}. Short keys keep
the file small, since it holds several thousand rows.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from qs_data import FUTURES_NAMES, asset_class, currency_for, write_atomic_text  # noqa: E402

US_SYMBOL = re.compile(r"[A-Z0-9]+(\.[A-Z])?")
# NSE/BSE symbols with "_" or ".RR" have no unambiguous source symbol (M_M could be M&M or M-M), so they are left out.
IN_SYMBOL = re.compile(r"[A-Z0-9&-]+")


def _read(path: Path) -> pd.DataFrame | None:
    if not path.exists():
        print(f"  (metadata file not found, skipped: {path})")
        return None
    return pd.read_csv(path, dtype=str).fillna("")


def us_symbol(raw: str) -> str | None:
    """BRK.B -> BRK-B (the source's class-share form). None when the symbol is not usable."""
    raw = raw.strip()
    return raw.replace(".", "-") if US_SYMBOL.fullmatch(raw) else None


def in_symbol(raw: str, exchange: str) -> str | None:
    suffix = {"NSE": ".NS", "BSE": ".BO"}.get(exchange)
    raw = raw.strip()
    return f"{raw}{suffix}" if suffix and IN_SYMBOL.fullmatch(raw) else None


def build_catalog(meta_dir: Path) -> list[dict]:
    rows: dict[str, dict] = {}

    def add(symbol: str, name: str, exchange: str, cls: str, currency: str) -> None:
        name = name.strip()
        if symbol and name and symbol not in rows:
            rows[symbol] = {"s": symbol, "n": name, "a": cls, "c": currency, "e": exchange}

    for sym, name in FUTURES_NAMES.items():
        add(sym, name, "CME", "futures", currency_for(sym))

    inr_indices: set[str] = set()
    for fname, inr in (("us_indices.csv", False), ("indian_indices.csv", True)):
        df = _read(meta_dir / fname)
        if df is None:
            continue
        if inr:
            inr_indices.update(df["symbol"])
        for r in df.itertuples(index=False):
            add(r.symbol, r.name, r.exchange, "index", currency_for(r.symbol, inr_indices if inr else set()) if inr else "USD")

    df = _read(meta_dir / "forex_tickers.csv")
    if df is not None:
        for r in df.itertuples(index=False):
            add(r.symbol, r.name, "FX", "forex", currency_for(r.symbol))

    df = _read(meta_dir / "US_Stocks_Data.csv")
    if df is not None:
        df = df[df["Exchange"] != "OTC"]  # OTC excluded (CLAUDE.md §8)
        for r in df.itertuples(index=False):
            sym = us_symbol(r.Symbol)
            if sym:
                add(sym, r.Description, r.Exchange, asset_class(sym), "USD")

    df = _read(meta_dir / "India_Stocks_Data.csv")
    if df is not None:
        nse = set(df.loc[df["Exchange"] == "NSE", "Symbol"])
        for r in df.itertuples(index=False):
            if r.Exchange == "BSE" and r.Symbol in nse:
                continue  # listed on both: keep the NSE line only
            sym = in_symbol(r.Symbol, r.Exchange)
            if sym:
                add(sym, r.Description, r.Exchange, "stock", "INR")

    return list(rows.values())


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--meta", default="data")
    p.add_argument("--out", default="public/data/catalog.json")
    args = p.parse_args(argv)
    catalog = build_catalog(Path(args.meta))
    if not catalog:
        print("No metadata found; catalog not written.")
        return 1
    out = Path(args.out)
    write_atomic_text(out, json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n")
    by_class: dict[str, int] = {}
    for r in catalog:
        by_class[r["a"]] = by_class.get(r["a"], 0) + 1
    print(f"Wrote {out}: {len(catalog)} tickers {by_class} ({out.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
