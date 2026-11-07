import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_index import build_index, load_metadata  # noqa: E402

META = Path(__file__).resolve().parents[2] / "data"


def _write_symbol(dirpath: Path, safe: str, symbol: str, rows: list[str]):
    (dirpath / f"{safe}.csv").write_text("time,open,high,low,close,volume\n" + "\n".join(rows) + "\n")
    (dirpath / f"{safe}.meta.json").write_text(json.dumps({"symbol": symbol}))


def test_metadata_names_and_exclusions():
    m = load_metadata(META)
    assert m.names["^GSPC"] == "S&P 500"
    assert m.names["^NSEI"] == "Nifty 50"
    assert m.names["EURUSD=X"] == "EUR/USD"
    assert m.names["NQ=F"].startswith("Nasdaq 100")
    assert m.names["RELIANCE.NS"] == "Reliance Industries Limited"
    assert "^NSEI" in m.inr_indices and "^GSPC" not in m.inr_indices
    # Every OTC ticker is excluded from the US stock names.
    import pandas as pd

    us = pd.read_csv(META / "US_Stocks_Data.csv", dtype=str)
    otc_only = set(us.loc[us["Exchange"] == "OTC", "Symbol"]) - set(us.loc[us["Exchange"] != "OTC", "Symbol"])
    assert otc_only and not (otc_only & set(m.names))


def test_build_index_entries(tmp_path):
    _write_symbol(tmp_path, "_NSEI", "^NSEI", ["60,1,2,0.5,1.5,0", "120,1,2,0.5,1.5,0", "180,1,2,0.5,1.5,0"])
    _write_symbol(tmp_path, "NQ_F", "NQ=F", ["60,1,2,0.5,1.5,0"])
    (tmp_path / "orphan.meta.json").write_text(json.dumps({"symbol": "X"}))  # no CSV -> skipped
    index = build_index(tmp_path, META)
    assert [i["symbol"] for i in index] == ["NQ=F", "^NSEI"]  # futures before index
    nsei = index[1]
    assert nsei == {
        "symbol": "^NSEI",
        "name": "Nifty 50",
        "assetClass": "index",
        "currency": "INR",
        "dataFile": "_NSEI.csv",
        "barsAvailable": 3,
        "firstTime": 60,
        "lastTime": 180,
        "lotStep": 0.01,
        "priceDecimals": 2,
        "sector": "Diversified / Broad Market",
    }
