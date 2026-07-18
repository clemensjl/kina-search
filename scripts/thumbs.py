"""Laedt alle Item-Bilder, skaliert auf 180px-WebP nach site/thumbs/ und
schreibt items.json auf lokale Pfade um. Idempotent: vorhandene Thumbs bleiben.
"""
import hashlib
import io
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "site" / "items.json"
THUMBS = ROOT / "site" / "thumbs"
THUMBS.mkdir(exist_ok=True)

SIZE = 180
HEADERS = {"User-Agent": "Mozilla/5.0", "Referer": "https://docs.google.com/"}


def key(url):
    return hashlib.sha1(url.encode()).hexdigest()[:16]


def grab(url):
    out = THUMBS / f"{key(url)}.webp"
    if out.exists():
        return url, f"thumbs/{out.name}"
    try:
        r = requests.get(url, timeout=30, headers=HEADERS)
        if r.status_code != 200 or not r.content:
            return url, ""
        img = Image.open(io.BytesIO(r.content))
        img.thumbnail((SIZE, SIZE))
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        img.save(out, "WEBP", quality=70, method=4)
        return url, f"thumbs/{out.name}"
    except Exception:
        return url, ""


def main():
    items = json.loads(ITEMS.read_text(encoding="utf-8"))
    urls = sorted({it["i"] for it in items if it["i"] and it["i"].startswith("http")})
    print(f"{len(urls)} Bild-URLs")
    mapping = {}
    done = 0
    with ThreadPoolExecutor(max_workers=16) as ex:
        for url, local in ex.map(grab, urls):
            mapping[url] = local
            done += 1
            if done % 1000 == 0:
                ok = sum(1 for v in mapping.values() if v)
                print(f"  {done}/{len(urls)} ({ok} ok)")
    ok = sum(1 for v in mapping.values() if v)
    print(f"fertig: {ok}/{len(urls)} Bilder")
    for it in items:
        if it["i"] in mapping:
            it["i"] = mapping[it["i"]]
    ITEMS.write_text(json.dumps(items, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    total_mb = sum(f.stat().st_size for f in THUMBS.glob("*.webp")) // 1024 // 1024
    print(f"thumbs/: {total_mb} MB")


if __name__ == "__main__":
    main()
