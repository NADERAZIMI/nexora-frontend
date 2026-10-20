#!/usr/bin/env python3
"""Refresh read-only Bybit Spot tickers to a same-origin JSON file atomically."""
import json,os,pathlib,tempfile,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[2]
DEST=pathlib.Path(os.environ.get("NEXORA_TICKER_TARGET",str(ROOT/"current"/"spot-tickers.json")))
errors=[]
for origin in ("https://api.bybit.com","https://api.bytick.com"):
    try:
        request=urllib.request.Request(origin+"/v5/market/tickers?category=spot",headers={"User-Agent":"NEXORA-Public-Market-Cache/1.0","Accept":"application/json"})
        with urllib.request.urlopen(request,timeout=25) as response: obj=json.load(response)
        if obj.get("retCode")!=0:raise ValueError("Bybit retCode not zero")
        rows=obj.get("result",{}).get("list",[])
        if not isinstance(rows,list) or len(rows)<100:raise ValueError("Incomplete ticker list")
        tickers={}
        for x in rows:
            try:
                symbol=str(x["symbol"])
                price=float(x["lastPrice"]);change=float(x["price24hPcnt"]);turnover=float(x["turnover24h"])
                if not symbol.isalnum() or price<=0 or not all(map(__import__('math').isfinite,(price,change,turnover))):continue
                tickers[symbol]={"lastPrice":price,"change":change,"turnover":turnover}
            except (KeyError,TypeError,ValueError):continue
        if len(tickers)<100:raise ValueError("Insufficient valid tickers")
        DEST.parent.mkdir(parents=True,exist_ok=True)
        data=json.dumps({"source":"bybit-public-spot","updatedAt":__import__('time').time_ns()//1000000,"tickers":tickers},separators=(",",":"))
        fd,name=tempfile.mkstemp(prefix=".tickers-",suffix=".tmp",dir=DEST.parent)
        try:
            with os.fdopen(fd,"w",encoding="utf-8") as out:out.write(data)
            os.chmod(name,0o644)  # Nginx must read the public market snapshot.
            os.replace(name,DEST)
        finally:
            if os.path.exists(name):os.unlink(name)
        print("Refreshed",len(tickers),"Bybit Spot prices")
        break
    except Exception as exc:
        errors.append(f"{origin}: {exc}")
else:
    raise SystemExit("Failed to refresh Spot prices; keeping previous snapshot: "+"; ".join(errors))
