"""Letzter Build-Schritt: items.json kompaktieren.

- Kategorie als Index in meta.cats
- Bild-URLs ueber Praefix-Tabelle meta.iprefix ("<n>:<rest>")
- Quelle (s) und Tab (t) fallen weg: Herkunfts-Spreadsheets bleiben intern
"""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "site" / "items.json"


def main():
    data = json.loads(ITEMS.read_text(encoding="utf-8"))
    items = data["items"]
    meta = data["meta"]

    cats = sorted({it["c"] for it in items})
    c_idx = {c: i for i, c in enumerate(cats)}

    # haeufigste Bild-URL-Praefixe (bis einschliesslich letztem '/')
    pref_count = Counter()
    for it in items:
        i = it.get("i") or ""
        if "/" in i:
            pref_count[i[: i.rindex("/") + 1]] += 1
    iprefix = [p for p, n in pref_count.most_common(9) if n >= 100]
    p_idx = {p: i for i, p in enumerate(iprefix)}

    for it in items:
        it.pop("s", None)
        it.pop("t", None)
        it["c"] = c_idx[it["c"]]
        i = it.get("i") or ""
        if "/" in i:
            p = i[: i.rindex("/") + 1]
            if p in p_idx:
                it["i"] = f"{p_idx[p]}:{i[len(p):]}"

    meta.pop("sources", None)
    meta["cats"] = cats
    meta["iprefix"] = iprefix
    ITEMS.write_text(
        json.dumps({"meta": meta, "items": items}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"kompaktiert: {len(items)} items -> {ITEMS.stat().st_size // 1024 // 1024} MB")


if __name__ == "__main__":
    main()
