"""Treibt den Rest-Linkcheck ueber die Vercel-Function /api/check
(AWS-Egress-IPs statt gedrosselter lokaler/GitHub-IPs).
Aufruf: python scripts/drive_remote_check.py <CRAWL_KEY>
"""
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "site" / "items.json"
STATUS = ROOT / "data" / "link_status.json"
META = ROOT / "data" / "item_meta.json"
URL = "https://kina-search.vercel.app/api/check"

KEY = sys.argv[1]
BATCH = 20
PAR = 8


def check_batch(ids):
    for _ in range(3):
        try:
            r = requests.post(URL, json={"ids": ids}, headers={"x-crawl-key": KEY}, timeout=90)
            if r.status_code == 200:
                return r.json()["results"]
        except requests.RequestException:
            pass
        time.sleep(3)
    return [{"id": i, "s": "unknown"} for i in ids]


def main():
    status = json.loads(STATUS.read_text(encoding="utf-8")) if STATUS.exists() else {}
    meta = json.loads(META.read_text(encoding="utf-8")) if META.exists() else {}
    data = json.loads(ITEMS.read_text(encoding="utf-8"))
    items = data["items"] if isinstance(data, dict) else data
    pids = sorted({it["pid"] for it in items if it.get("pf") == "wd" and it.get("pid")})
    todo = [p for p in pids if f"wd:{p}" not in status or status[f"wd:{p}"] == "unknown"]
    print(f"{len(todo)} offene IDs, Batches a {BATCH}, {PAR} parallel")

    batches = [todo[i:i + BATCH] for i in range(0, len(todo), BATCH)]
    done = blocked = 0
    with ThreadPoolExecutor(max_workers=PAR) as ex:
        for results in ex.map(check_batch, batches):
            for r in results:
                k = f"wd:{r['id']}"
                if r["s"] in ("ok", "dead"):
                    status[k] = r["s"]
                    if r["s"] == "ok" and (r.get("img") or r.get("price")):
                        m = {}
                        if r.get("img"):
                            m["img"] = r["img"]
                        if r.get("price"):
                            m["price"] = r["price"]
                        meta[k] = m
                elif r["s"] == "blocked":
                    blocked += 1
            done += len(results)
            if done % 400 < BATCH:
                STATUS.write_text(json.dumps(status), encoding="utf-8")
                META.write_text(json.dumps(meta), encoding="utf-8")
                ok = sum(1 for v in status.values() if v == "ok")
                dead = sum(1 for v in status.values() if v == "dead")
                print(f"  {done}/{len(todo)} | gesamt: {ok} ok, {dead} dead, blocked: {blocked}", flush=True)

    status = {k: v for k, v in status.items() if v in ("ok", "dead")}
    STATUS.write_text(json.dumps(status), encoding="utf-8")
    META.write_text(json.dumps(meta), encoding="utf-8")
    rest = sum(1 for p in pids if f"wd:{p}" not in status)
    print(f"fertig; weiterhin offen: {rest}")


if __name__ == "__main__":
    main()
