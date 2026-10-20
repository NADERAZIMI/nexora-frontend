#!/usr/bin/env python3
"""Static inspection of a pinned npm tarball. NEVER executes package content."""
import hashlib
import io
import json
import os
from pathlib import Path
import re
import tarfile

TARBALL = Path(os.environ.get("TARBALL", "trading-chest-0.10.0.tgz"))
OUT = Path(os.environ.get("AUDIT_REPORT", "tradingchest-artifact-audit.json"))
MAX_FILES = 10000
MAX_BYTES = 80 * 1024 * 1024
FLAG_RULES = {
    "dynamic_code": r"\b(?:eval|new\s+Function|Function)\s*\(",
    "script_execution": r"\b(?:child_process|execSync|spawnSync|execFileSync|exec\s*\(|spawn\s*\()",
    "network": r"\b(?:fetch|WebSocket|XMLHttpRequest|sendBeacon)\s*\(",
    "storage": r"\b(?:localStorage|sessionStorage|indexedDB)\b",
    "secrets": r"\b(?:process\.env|document\.cookie|navigator\.clipboard)\b",
    "dynamic_import": r"\bimport\s*\(",
    "suspicious_schemes": r"(?:data:text/javascript|javascript:|https?://)",
}
COMPILED = {k: re.compile(v) for k, v in FLAG_RULES.items()}
report = {
    "target": "trading-chest@0.10.0",
    "sha256": hashlib.sha256(TARBALL.read_bytes()).hexdigest(),
    "file_count": 0,
    "total_unpacked_bytes": 0,
    "file_types": {},
    "url_literals": [],
    "flags": {},
    "package": {},
    "error": None,
}
urls = set()
try:
    with tarfile.open(TARBALL, "r:gz") as tf:
        members = tf.getmembers()
        if len(members) > MAX_FILES:
            raise ValueError("Too many archive members")
        for member in members:
            if member.issym() or member.islnk():
                raise ValueError("Archive has symbolic or hard links: " + member.name)
            if member.name.startswith("/") or ".." in Path(member.name).parts:
                raise ValueError("Unsafe archive path: " + member.name)
            if not member.isfile():
                continue
            if member.size > MAX_BYTES:
                raise ValueError("Oversized member: " + member.name)
            report["total_unpacked_bytes"] += member.size
            if report["total_unpacked_bytes"] > MAX_BYTES:
                raise ValueError("Archive exceeds bounded inspection size")
            report["file_count"] += 1
            suffix = Path(member.name).suffix or "<none>"
            report["file_types"][suffix] = report["file_types"].get(suffix, 0) + 1
            raw = tf.extractfile(member).read()
            if member.name == "package/package.json":
                report["package"] = json.loads(raw)
            if suffix not in (".js", ".mjs", ".cjs", ".json", ".html", ".css"):
                continue
            text = raw.decode("utf-8", "replace")
            for rule, regex in COMPILED.items():
                matches = list(regex.finditer(text))
                if matches:
                    report["flags"].setdefault(rule, []).append({
                        "path": member.name, "count": len(matches),
                        "samples": [text[max(0,m.start()-45):m.end()+55].replace("\n"," ") for m in matches[:3]]
                    })
            for url in re.findall(r'https?://[^\\s<>]{3,200}', text):
                urls.add(url[:200])
    report["url_literals"] = sorted(urls)[:300]
    pkg = report["package"]
    if pkg.get("name") != "trading-chest" or pkg.get("version") != "0.10.0":
        raise ValueError("Unexpected package name/version")
    scripts = pkg.get("scripts", {})
    report["lifecycle_scripts"] = {k:v for k,v in scripts.items() if k in ("preinstall","install","postinstall","prepare","prepublish","prepack")}
except Exception as ex:
    report["error"] = str(ex)
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False))
print(json.dumps({k:report[k] for k in ("target","sha256","file_count","total_unpacked_bytes","lifecycle_scripts","error")},indent=2))
print("Review flags manually: a match is NOT automatically malicious.")
if report["error"]:
    raise SystemExit(1)
