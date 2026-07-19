"""Merged Shard-Artefakte (+ lokale Crawl-Stände) in data/link_status.json
und data/item_meta.json. Druckt TODO=<n> (verbleibende ungeprüfte IDs).
Aufruf: python scripts/merge_linkcheck.py <artefakt-dir>
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATUS = ROOT / "data" / "link_status.json"
META = ROOT / "data" / "item_meta.json"
ITEMS = ROOT / "site" / "items.json"


def main():
    art_dir = Path(sys.argv[1])
    status = json.loads(STATUS.read_text(encoding="utf-8")) if STATUS.exists() else {}
    meta = json.loads(META.read_text(encoding="utf-8")) if META.exists() else {}
    for f in art_dir.rglob("*_status.json"):
        for k, v in json.loads(f.read_text(encoding="utf-8")).items():
            if v in ("ok", "dead"):
                status[k] = v
    for f in art_dir.rglob("*_meta.json"):
        meta.update(json.loads(f.read_text(encoding="utf-8")))
    # unknown-Reste rauswerfen: naechste Runde prueft sie neu
    status = {k: v for k, v in status.items() if v in ("ok", "dead")}
    STATUS.write_text(json.dumps(status), encoding="utf-8")
    META.write_text(json.dumps(meta), encoding="utf-8")

    data = json.loads(ITEMS.read_text(encoding="utf-8"))
    items = data["items"] if isinstance(data, dict) else data
    pids = {it["pid"] for it in items if it.get("pf") == "wd" and it.get("pid")}
    todo = sum(1 for p in pids if f"wd:{p}" not in status)
    ok = sum(1 for v in status.values() if v == "ok")
    dead = sum(1 for v in status.values() if v == "dead")
    print(f"gemergt: {ok} ok, {dead} dead, {len(meta)} meta")
    print(f"TODO={todo}")


if __name__ == "__main__":
    main()
