"""Entfernt Items mit eindeutig totem Weidian-Link aus site/items.json
(basierend auf data/link_status.json aus check_links.py). "unknown" bleibt drin.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "site" / "items.json"
STATUS = ROOT / "data" / "link_status.json"


def main():
    status = json.loads(STATUS.read_text(encoding="utf-8"))
    dead = {k for k, v in status.items() if v == "dead"}
    data = json.loads(ITEMS.read_text(encoding="utf-8"))
    items = data["items"] if isinstance(data, dict) else data
    kept = [it for it in items if not (it.get("pf") == "wd" and f"wd:{it.get('pid')}" in dead)]
    removed = len(items) - len(kept)
    if isinstance(data, dict):
        data["items"] = kept
    else:
        data = kept
    ITEMS.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{removed} tote Items entfernt, {len(kept)} verbleiben")


if __name__ == "__main__":
    main()
