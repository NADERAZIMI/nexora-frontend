#!/usr/bin/env python3
"""Cache token images into static frontend assets; never hotlink from users' browsers."""
import io,json,pathlib,tarfile,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
catalog=json.loads((ROOT/"public/spot-markets.json").read_text(encoding="utf-8"))
symbols={str(p["base"]).lower() for p in catalog["pairs"]}|{str(p["quote"]).lower() for p in catalog["pairs"]}
out=ROOT/"public/token-icons"
out.mkdir(parents=True,exist_ok=True)
# The CI cache restores previously validated assets. Avoid redownloading the archive.
if (out/"manifest.json").is_file() and len(list(out.glob("*.png")))>=15:
    print("Reusing validated cached token images:",len(list(out.glob("*.png"))))
    raise SystemExit(0)
url="https://codeload.github.com/spothq/cryptocurrency-icons/tar.gz/refs/heads/master"
request=urllib.request.Request(url,headers={"User-Agent":"NEXORA-Asset-Build/1.0"})
with urllib.request.urlopen(request,timeout=60) as response:
    archive=response.read()
count=0
with tarfile.open(fileobj=io.BytesIO(archive),mode="r:gz") as tar:
    for item in tar:
        if not item.isfile() or not item.name.startswith("cryptocurrency-icons-master/128/color/"):
            continue
        name=item.name.rsplit("/",1)[-1]
        if not name.endswith(".png") or name[:-4] not in symbols:continue
        data=tar.extractfile(item).read()
        if not (data.startswith(b"\x89PNG\r\n\x1a\n") and 100<len(data)<200000):continue
        (out/name).write_bytes(data)
        count+=1
if count<15:raise SystemExit(f"ERROR: insufficient validated token images: {count}")
for essential in ["btc","eth","usdt","sol","xrp"]:
    if not (out/(essential+".png")).is_file():
        print("Icon absent from upstream set:",essential)
(out/"manifest.json").write_text(json.dumps({"symbols":sorted(p.stem.upper() for p in out.glob("*.png"))},separators=(",",":")),encoding="utf-8")
print(f"Cached {count} distinct token logos locally for {len(symbols)} unique assets; other assets use a letter placeholder")
