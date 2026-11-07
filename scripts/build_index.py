"""Build public/data/index.json (an array of SymbolInfo) from the candle files in public/data.

    python scripts/build_index.py [--data public/data] [--meta data]

Names and sectors come from the supplied metadata lists in data/ (they are not price history).
Currency, asset class, lot step and price decimals come from the maps in qs_data.py.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from qs_data import (  # noqa: E402
    CANDLE_COLUMNS,
    FUTURES_NAMES,
    asset_class,
    currency_for,
    lot_step_for,
    price_decimals_for,
    write_atomic_text,
)

CLASS_ORDER = {"futures": 0, "index": 1, "forex": 2, "stock": 3, "crypto": 4}


@dataclass
class Metadata:
    names: dict[str, str] = field(default_factory=dict)
    sectors: dict[str, str] = field(default_factory=dict)
    index_symbols: set[str] = field(default_factory=set)
    inr_indices: set[str] = field(default_factory=set)


def _read(path: Path) -> pd.DataFrame | None:
    if not path.exists():
        print(f"  (metadata file not found, skipped: {path})")
        return None
    return pd.read_csv(path, dtype=str).fillna("")


def load_metadata(meta_dir: Path) -> Metadata:
    m = Metadata()
    for fname, inr in (("us_indices.csv", False), ("indian_indices.csv", True)):
        df = _read(meta_dir / fname)
        if df is None:
            continue
        for row in df.itertuples(index=False):
            m.names[row.symbol] = row.name
            m.sectors[row.symbol] = row.sector
            m.index_symbols.add(row.symbol)
            if inr:
                m.inr_indices.add(row.symbol)

    df = _read(meta_dir / "forex_tickers.csv")
    if df is not None:
        # Only the name is used. The price columns are a snapshot, never candle data (CLAUDE.md §8).
        m.names.update(dict(zip(df["symbol"], df["name"])))

    df = _read(meta_dir / "US_Stocks_Data.csv")
    if df is not None:
        df = df[df["Exchange"] != "OTC"]  # OTC excluded (CLAUDE.md §8)
        for row in df.itertuples(index=False):
            m.names.setdefault(row.Symbol, row.Description)
            m.sectors.setdefault(row.Symbol, row.Sector)

    df = _read(meta_dir / "India_Stocks_Data.csv")
    if df is not None:
        # NSE rows first so the NSE description wins for companies listed on both exchanges.
        df = df.sort_values("Exchange", key=lambda s: s.map({"NSE": 0, "BSE": 1}).fillna(2))
        for row in df.itertuples(index=False):
            suffix = {"NSE": ".NS", "BSE": ".BO"}.get(row.Exchange)
            if not suffix:
                continue
            sym = f"{row.Symbol}{suffix}"
            m.names.setdefault(sym, row.Description)
            m.sectors.setdefault(sym, row.Sector)

    m.names.update(FUTURES_NAMES)
    return m


def summarise_csv(path: Path) -> tuple[int, int, int]:
    """(rows, first_time, last_time). Validates the header."""
    with path.open(encoding="utf-8") as f:
        header = f.readline().strip()
        if header.split(",") != CANDLE_COLUMNS:
            raise ValueError(f"{path.name}: bad header {header!r}")
        first = last = None
        rows = 0
        for line in f:
            if not line.strip():
                continue
            rows += 1
            if first is None:
                first = line
            last = line
    if rows == 0:
        raise ValueError(f"{path.name}: no rows")
    return rows, int(first.split(",")[0]), int(last.split(",")[0])


def symbol_info(symbol: str, csv_path: Path, meta: Metadata) -> dict:
    cls = asset_class(symbol, meta.index_symbols)
    currency = currency_for(symbol, meta.inr_indices)
    rows, first, last = summarise_csv(csv_path)
    name = meta.names.get(symbol)
    if not name:
        print(f"  warning: no name for {symbol}; using the symbol")
        name = symbol
    info = {
        "symbol": symbol,
        "name": name,
        "assetClass": cls,
        "currency": currency,
        "dataFile": csv_path.name,
        "barsAvailable": rows,
        "firstTime": first,
        "lastTime": last,
        "lotStep": lot_step_for(symbol, cls),
        "priceDecimals": price_decimals_for(symbol, cls, currency),
    }
    sector = meta.sectors.get(symbol)
    if sector:
        info["sector"] = sector
    return info


def build_index(data_dir: Path, meta_dir: Path) -> list[dict]:
    meta = load_metadata(meta_dir)
    out = []
    for meta_file in sorted(data_dir.glob("*.meta.json")):
        sidecar = json.loads(meta_file.read_text(encoding="utf-8"))
        csv_path = meta_file.with_name(meta_file.name.replace(".meta.json", ".csv"))
        if not csv_path.exists():
            print(f"  warning: {meta_file.name} has no matching CSV; skipped")
            continue
        out.append(symbol_info(sidecar["symbol"], csv_path, meta))
    out.sort(key=lambda i: (CLASS_ORDER.get(i["assetClass"], 9), i["symbol"]))
    return out


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Build public/data/index.json")
    p.add_argument("--data", default="public/data")
    p.add_argument("--meta", default="data")
    args = p.parse_args(argv)

    data_dir = Path(args.data)
    index = build_index(data_dir, Path(args.meta))
    if not index:
        print("No candle files found. Run scripts/fetch_data.py first.")
        return 1
    write_atomic_text(data_dir / "index.json", json.dumps(index, indent=2) + "\n")
    for i in index:
        print(f"  {i['symbol']:<10} {i['assetClass']:<8} {i['currency']}  lot {i['lotStep']:<6} dp {i['priceDecimals']}  {i['barsAvailable']:>6} bars  {i['name']}")
    print(f"Wrote {data_dir / 'index.json'} ({len(index)} symbols)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
