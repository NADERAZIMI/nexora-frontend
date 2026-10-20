#!/usr/bin/env python3
"""One-time/resumable NEXORA catalog import. Python stdlib only.

Live prices/order books remain on MEXC. This script downloads static metadata
once to a persistent directory; the browser never queries CoinGecko.
"""
import argparse
import json
import os
from pathlib import Path
import re
import time
import urllib.error
import urllib.request

API = "https://api.coingecko.com/api/v3"
DEFAULT_DIR = "/home/nexora-deploy/nexora-frontend/data/token-assets"
KNOWN = {"1INCH": "1inch", "BTC": "bitcoin", "ETH": "ethereum",
         "SOL": "solana", "BNB": "binancecoin", "XRP": "ripple",
         "SHIDO": "shido-2", "DOGE": "dogecoin", "ADA": "cardano",
         "LTC": "litecoin", "USDC": "usd-coin", "USDT": "tether"}
MAX_ICON = 512 * 1024


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    temp.replace(path)


def fetch_json(url, key):
    try:
        req = urllib.request.Request(url, headers={"x-cg-demo-api-key": key, "Accept": "application/json",
                                                    "User-Agent": "NEXORA-catalog/1.0"})
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except (urllib.error.HTTPError, urllib.error.URLError, OSError, ValueError) as exc:
        print("Failed:", url.split("?")[0], str(exc)[:120], flush=True)
        return None


def icon_download(url, target):
    if not isinstance(url, str) or not url.startswith("https://"):
        return False
    try:
        with urllib.request.urlopen(urllib.request.Request(
                url, headers={"User-Agent": "NEXORA-catalog/1.0"}), timeout=20) as response:
            media = response.headers.get("content-type", "").split(";")[0]
            if media not in ("image/png", "image/webp"):
                return False
            blob = response.read(MAX_ICON + 1)
            if len(blob) > MAX_ICON or not blob:
                return False
            target.write_bytes(blob)
            return True
    except (OSError, urllib.error.URLError):
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", default=DEFAULT_DIR)
    parser.add_argument("--profiles-limit", type=int, default=100,
                        help="New profiles per run (resumable; 0 skips)")
    parser.add_argument("--icon-pages", type=int, default=8,
                        help="Ranked CoinGecko batches of 250 (0 skips)")
    parser.add_argument("--delay", type=float, default=3.0)
    args = parser.parse_args()
    key = os.environ.get("COINGECKO_DEMO_API_KEY", "").strip()
    if not key:
        parser.error("Set COINGECKO_DEMO_API_KEY for the one-time import")
    root = Path(args.directory).resolve()
    (root / "profiles").mkdir(parents=True, exist_ok=True)
    (root / "icons").mkdir(parents=True, exist_ok=True)

    list_path = root / "coins-list.json"
    if list_path.exists():
        coins = json.loads(list_path.read_text(encoding="utf-8"))
    else:
        coins = fetch_json(API + "/coins/list?include_platform=false", key)
        if not isinstance(coins, list):
            print("Coin list unavailable; retry later")
            return
        save_json(list_path, coins)
    by_symbol, duplicates = {}, set()
    for coin in coins:
        if not isinstance(coin, dict):
            continue
        sym, ident = str(coin.get("symbol", "")).upper(), coin.get("id")
        if not re.fullmatch(r"[A-Z0-9]{2,40}", sym) or not isinstance(ident, str):
            continue
        if sym in by_symbol:
            by_symbol.pop(sym, None)
            duplicates.add(sym)
        elif sym not in duplicates:
            by_symbol[sym] = ident

    icons_path = root / "icons.json"
    icons = json.loads(icons_path.read_text(encoding="utf-8")) if icons_path.exists() else {}
    if args.icon_pages:
        for page in range(1, args.icon_pages + 1):
            data = fetch_json(API + f"/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page={page}&sparkline=false", key)
            if not isinstance(data, list):
                break
            for coin in data:
                if not isinstance(coin, dict):
                    continue
                symbol, ident, src = str(coin.get("symbol", "")).upper(), coin.get("id"), coin.get("image")
                if by_symbol.get(symbol) != ident and KNOWN.get(symbol) != ident:
                    continue  # Never assign a logo to an ambiguous symbol
                if not isinstance(ident, str) or not re.fullmatch(r"[a-z0-9-]+", ident):
                    continue
                file = root / "icons" / (ident + ".png")
                if file.exists() or icon_download(src, file):
                    icons[symbol] = "/token-assets/icons/" + file.name
            save_json(icons_path, icons)
            print("Icon page", page, "saved; icons", len(icons), flush=True)
            time.sleep(args.delay)
            if len(data) < 250:
                break

    completed = 0
    # Stable identities first, then unique ticker identities.
    ids = dict(by_symbol)
    ids.update(KNOWN)
    for symbol, ident in ids.items():
        if completed >= args.profiles_limit:
            break
        if not re.fullmatch(r"[a-z0-9-]+", ident):
            continue
        file = root / "profiles" / (ident + ".json")
        if file.exists():
            continue
        data = fetch_json(API + "/coins/" + ident +
                          "?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false", key)
        if not isinstance(data, dict) or str(data.get("symbol", "")).upper() != symbol:
            continue
        save_json(file, data)
        completed += 1
        print("Saved", symbol, ident, flush=True)
        time.sleep(args.delay)
    print(f"Complete: {len(icons)} icons; {completed} new profiles. Files retained under {root}")


if __name__ == "__main__":
    main()
