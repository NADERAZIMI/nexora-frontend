#!/usr/bin/env python3
"""Produce genuine Bybit Spot OHLCV snapshots on the Turkey deploy host.

The browser may be geo-blocked from Bybit REST while its public WebSocket works.
These snapshots are served same-origin; no fabricated candle values are used.
"""
import json
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

PAIRS = ("BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT")
INTERVALS = ("1", "5", "15", "30", "60", "240", "D", "W")
BASE = "https://api.bybit.com/v5/market/kline"


def main():
    output = pathlib.Path("kline-cache")
    failures = []
    total = 0
    for symbol in PAIRS:
        for interval in INTERVALS:
            params = urllib.parse.urlencode({"category": "spot", "symbol": symbol, "interval": interval, "limit": 500})
            try:
                req = urllib.request.Request(BASE + "?" + params, headers={"User-Agent": "NEXORA-Frontend/1.0"})
                with urllib.request.urlopen(req, timeout=12) as result:
                    payload = json.load(result)
                rows = payload.get("result", {}).get("list", [])
                if payload.get("retCode") != 0 or len(rows) < 50:
                    raise ValueError("invalid or insufficient history")
                target = output / symbol / (interval + ".json")
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(json.dumps({"symbol": symbol, "interval": interval, "generatedAt": int(time.time() * 1000), "list": rows}, separators=(",", ":")), encoding="utf-8")
                total += 1
            except (urllib.error.URLError, TimeoutError, ValueError, OSError, KeyError) as exc:
                failures.append(f"{symbol}/{interval}: {exc}")
    print(f"Bybit candle cache: {total}/{len(PAIRS) * len(INTERVALS)} feeds")
    for error in failures:
        print("WARNING:", error)
    # Do not block the entire website deployment on a regional Bybit outage.
    if total == 0:
        print("WARNING: Bybit REST unreachable from deploy host; no historical snapshots were generated.")


if __name__ == "__main__":
    main()
