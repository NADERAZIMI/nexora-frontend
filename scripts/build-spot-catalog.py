#!/usr/bin/env python3
"""Generate the NEXORA public Spot catalog at build time. No trading credentials."""
import json
import pathlib
import urllib.parse
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUTPUT=ROOT/"public"/"spot-markets.json"
all_rows={}
for origin in ["https://api.bybit.com", "https://api.bytick.com"]:
    try:
        cursor=""
        for _ in range(12):
            args={"category":"spot"}
            
            url=origin+"/v5/market/instruments-info?"+urllib.parse.urlencode(args)
            request=urllib.request.Request(url, headers={"User-Agent":"NEXORA-Public-Spot-Catalog/1.0","Accept":"application/json"})
            with urllib.request.urlopen(request,timeout=28) as response:
                payload=json.load(response)
            if payload.get("retCode")!=0 or not isinstance(payload.get("result",{}).get("list"),list):
                raise RuntimeError("invalid Bybit response")
            for item in payload["result"]["list"]:
                symbol=item.get("symbol")
                base=item.get("baseCoin")
                quote=item.get("quoteCoin")
                if (item.get("status")=="Trading" and isinstance(symbol,str) and
                    isinstance(base,str) and isinstance(quote,str) and symbol.isalnum()):
                    all_rows[symbol]={"symbol":symbol,"base":base,"quote":quote}
            break
        if len(all_rows)>=100:break
    except Exception as e:
        print("Catalog source unavailable:",origin,type(e).__name__,str(e)[:100])
if len(all_rows)<100:
    raise SystemExit(f"ERROR: Bybit catalog incomplete ({len(all_rows)} pairs). Refuse partial release.")
OUTPUT.parent.mkdir(parents=True,exist_ok=True)
OUTPUT.write_text(json.dumps({"source":"bybit-public-spot","pairs":sorted(all_rows.values(),key=lambda x:x["symbol"])},ensure_ascii=False,separators=(",",":")),encoding="utf-8")
print("Wrote",len(all_rows),"Bybit Spot pairs to",OUTPUT)
