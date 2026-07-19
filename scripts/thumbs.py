"""Laedt alle Item-Bilder in hoher Aufloesung, skaliert auf 320px-WebP nach
site/thumbs/ und schreibt items.json auf lokale Pfade um. Idempotent; nicht mehr
referenzierte Thumbs werden geloescht.

Google liefert Sheet-Bilder standardmaessig in Zellaufloesung (=w165-h139).
hires() ersetzt das Groessensuffix durch =s512 -> echte Qualitaet statt Upscale.
"""
import hashlib
import io
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "site" / "items.json"
THUMBS = ROOT / "site" / "thumbs"
THUMBS.mkdir(exist_ok=True)

SIZE = 320
HEADERS = {"User-Agent": "Mozilla/5.0", "Referer": "https://docs.google.com/"}
GOOGLE_IMG = re.compile(r"^https://(lh\d+\.googleusercontent\.com|docs\.google\.com)/")
# lh*.googleusercontent liefert ohne CORP-Header -> direkt hotlinken statt hosten
HOTLINK = re.compile(r"^https://lh\d+\.googleusercontent\.com/")
SIZE_SUFFIX = re.compile(r"=[swh]\d+(-[hwp][\d-]*)*$")


def hires(url):
    if GOOGLE_IMG.match(url) and SIZE_SUFFIX.search(url):
        return SIZE_SUFFIX.sub("=s512", url)
    return url


def key(url):
    return hashlib.sha1(("v2:" + url).encode()).hexdigest()[:16]


def grab(url):
    out = THUMBS / f"{key(url)}.webp"
    if out.exists():
        return url, f"thumbs/{out.name}"
    for candidate in dict.fromkeys([hires(url), url]):
        try:
            r = requests.get(candidate, timeout=30, headers=HEADERS)
            if r.status_code != 200 or not r.content:
                continue
            img = Image.open(io.BytesIO(r.content))
            img.thumbnail((SIZE, SIZE))
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")
            img.save(out, "WEBP", quality=68, method=4)
            return url, f"thumbs/{out.name}"
        except Exception:
            continue
    return url, ""


def main():
    data = json.loads(ITEMS.read_text(encoding="utf-8"))
    items = data["items"] if isinstance(data, dict) else data
    urls = sorted({it["i"] for it in items if it["i"] and it["i"].startswith("http")})
    mapping = {u: hires(u) for u in urls if HOTLINK.match(u)}
    to_fetch = [u for u in urls if u not in mapping]
    print(f"{len(urls)} Bild-URLs ({len(mapping)} hotlink, {len(to_fetch)} lokal)")
    done = 0
    with ThreadPoolExecutor(max_workers=16) as ex:
        for url, local in ex.map(grab, to_fetch):
            mapping[url] = local
            done += 1
            if done % 2000 == 0:
                ok = sum(1 for v in mapping.values() if v)
                print(f"  {done}/{len(to_fetch)} ({ok} ok)")
    ok = sum(1 for v in mapping.values() if v)
    print(f"fertig: {ok}/{len(urls)} Bilder")
    for it in items:
        if it["i"] in mapping:
            it["i"] = mapping[it["i"]]
    ITEMS.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # Referenzen einsammeln - auch kompakt-codierte Pfade ("<n>:<rest>" via
    # meta.iprefix) dekodieren, sonst wird der komplette Thumb-Bestand als
    # verwaist gewertet und geloescht (passiert am 19.07., aus Git restauriert)
    iprefix = data.get("meta", {}).get("iprefix", []) if isinstance(data, dict) else []
    keep = set()
    for it in items:
        p = it["i"] or ""
        if p and p[0].isdigit() and ":" in p[:4]:
            k = p.index(":")
            try:
                p = iprefix[int(p[:k])] + p[k + 1:]
            except (ValueError, IndexError):
                pass
        if p.startswith("thumbs/"):
            keep.add(p.removeprefix("thumbs/"))
    stale = [f for f in THUMBS.glob("*.webp") if f.name not in keep]
    if keep and len(stale) > max(100, len(keep) // 10):
        print(f"WARNUNG: {len(stale)} von {len(keep) + len(stale)} Thumbs waeren verwaist - Loeschung uebersprungen")
        stale = []
    for f in stale:
        f.unlink()
    total_mb = sum(f.stat().st_size for f in THUMBS.glob("*.webp")) // 1024 // 1024
    print(f"{len(stale)} verwaiste Thumbs geloescht; thumbs/: {total_mb} MB")


if __name__ == "__main__":
    main()
