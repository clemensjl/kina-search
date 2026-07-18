"""Fuellt fehlende Bilder und Preise aus data/item_meta.json (Weidian-Crawl)
in site/items.json auf. Funktioniert auf Roh- und Kompakt-Format.
Nachgeladene http-Bilder werden vom naechsten thumbs.py-Lauf lokal gecacht.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "site" / "items.json"
META = ROOT / "data" / "item_meta.json"


def main():
    if not META.exists():
        print("kein item_meta.json - nichts zu tun")
        return
    meta = json.loads(META.read_text(encoding="utf-8"))
    data = json.loads(ITEMS.read_text(encoding="utf-8"))
    items = data["items"] if isinstance(data, dict) else data
    imgs = prices = 0
    for it in items:
        if it.get("pf") != "wd":
            continue
        m = meta.get(f"wd:{it.get('pid')}")
        if not m:
            continue
        if not it.get("i") and m.get("img"):
            it["i"] = m["img"]
            imgs += 1
        if it.get("pv") is None and not it.get("p") and m.get("price"):
            it["pv"], it["pc"] = round(float(m["price"]), 2), "CNY"
            prices += 1
    ITEMS.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"enrich: {imgs} Bilder, {prices} Preise ergaenzt")


if __name__ == "__main__":
    main()
