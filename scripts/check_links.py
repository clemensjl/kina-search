"""Prueft alle Weidian-Links auf Funktionalitaet (HTTP, kein LLM noetig) und
extrahiert dabei Hauptbild + Preis fuer Items, denen beides im Sheet fehlt.

Live-Erkennung: Weidian rendert bei existierenden Items einen SSR-Datenblob
(u.a. &#34;shopName&#34;) ins HTML; bei geloeschten Items fehlt er.
Taobao/1688 sind ohne Login nicht zuverlaessig pruefbar -> bleiben ungeprueft.

Ergebnis: data/link_status.json  {"wd:<id>": "ok"|"dead"}
          data/item_meta.json    {"wd:<id>": {"img": url, "price": cny}}
Danach: enrich.py (Bilder/Preise auffuellen), prune_dead.py (tote Items raus).
"""
import html as htmllib
import json
import random
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / "site" / "items.json"
STATUS = ROOT / "data" / "link_status.json"
META = ROOT / "data" / "item_meta.json"

IMG_RE = re.compile(r"https://si\.geilicdn\.com/[^\"'\s\\]+?\.(?:jpg|jpeg|png|webp)[^\"'\s\\]*")
PRICE_RE = re.compile(r'"(?:price|minPrice|itemPrice|priceText)"\s*:\s*"?(\d+(?:\.\d+)?)"?')

LIVE_MARKER = "&#34;shopName&#34;"
DEAD_MARKER = "商品不存在"
HEADERS = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"}
WORKERS = 3

lock = threading.Lock()
status: dict[str, str] = {}
meta: dict[str, dict] = {}
counters = {"ok": 0, "dead": 0, "unknown": 0, "err_streak": 0}
local = threading.local()
cooldown_until = 0.0


def respect_cooldown():
    while True:
        with lock:
            wait = cooldown_until - time.time()
        if wait <= 0:
            return
        time.sleep(min(wait, 5))


def trigger_cooldown(seconds):
    global cooldown_until
    with lock:
        cooldown_until = max(cooldown_until, time.time() + seconds)


def session():
    if not hasattr(local, "s"):
        local.s = requests.Session()
        local.s.headers.update(HEADERS)
    return local.s


def check(pid: str) -> str:
    for attempt in range(4):
        respect_cooldown()
        try:
            r = session().get(
                f"https://weidian.com/item.html?itemID={pid}", timeout=20
            )
            if r.status_code in (403, 429):
                trigger_cooldown(90 + attempt * 60)
                continue
            if r.status_code != 200:
                return "unknown"
            if LIVE_MARKER in r.text:
                u = htmllib.unescape(r.text)
                img = IMG_RE.search(u)
                price = PRICE_RE.search(u)
                m = {}
                if img:
                    m["img"] = img.group(0)
                if price:
                    try:
                        cny = float(price.group(1))
                        # Weidian liefert Preise teils in Fen (Cent)
                        m["price"] = cny / 100 if cny > 10000 else cny
                    except ValueError:
                        pass
                if m:
                    with lock:
                        meta[f"wd:{pid}"] = m
                return "ok"
            if DEAD_MARKER in r.text:
                return "dead"
            # tote Shell ~25 KB, lebende Seite >30 KB; dazwischen -> unklar lassen
            if len(r.text) < 27000:
                return "dead"
            return "unknown"
        except requests.RequestException:
            # Weidian kappt Verbindungen bei Drosselung -> global abkuehlen
            trigger_cooldown(60 + attempt * 60)
            if hasattr(local, "s"):
                local.s.close()
                del local.s
    return "unknown"


def worker(pid: str):
    res = check(pid)
    with lock:
        status[f"wd:{pid}"] = res
        counters[res] += 1
        if res == "unknown":
            counters["err_streak"] += 1
        else:
            counters["err_streak"] = 0
        done = counters["ok"] + counters["dead"] + counters["unknown"]
        if done % 1000 == 0:
            STATUS.write_text(json.dumps(status), encoding="utf-8")
            META.write_text(json.dumps(meta), encoding="utf-8")
            print(f"  {done} geprueft: {counters['ok']} ok, {counters['dead']} tot, {counters['unknown']} unklar, {len(meta)} meta", flush=True)
    time.sleep(random.uniform(0.4, 0.9))


def main():
    data = json.loads(ITEMS.read_text(encoding="utf-8"))
    items = data["items"] if isinstance(data, dict) else data
    pids = sorted({it["pid"] for it in items if it.get("pf") == "wd" and it.get("pid")})
    if META.exists():
        meta.update(json.loads(META.read_text(encoding="utf-8")))
    if STATUS.exists():
        # unknown-Eintraege erneut pruefen, nur ok/dead sind final
        prev = json.loads(STATUS.read_text(encoding="utf-8"))
        status.update({k: v for k, v in prev.items() if v != "unknown"})
    todo = [p for p in pids if f"wd:{p}" not in status]
    print(f"{len(pids)} Weidian-IDs, {len(todo)} noch zu pruefen", flush=True)

    # Sanity-Phase: wenn fast alles "dead" erkannt wird, stimmt der Marker
    # nicht oder wir sind geblockt -> Abbruch statt Datenmord
    sample = todo[:150]
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        list(ex.map(worker, sample))
    checked = counters["ok"] + counters["dead"] + counters["unknown"]
    if checked and counters["dead"] / max(checked, 1) > 0.7:
        STATUS.write_text(json.dumps(status), encoding="utf-8")
        raise SystemExit("ABBRUCH: >70% als tot erkannt - Marker/Blocking pruefen.")

    rest = todo[150:]
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        list(ex.map(worker, rest))
    STATUS.write_text(json.dumps(status), encoding="utf-8")
    META.write_text(json.dumps(meta), encoding="utf-8")
    print(f"fertig: {counters['ok']} ok, {counters['dead']} tot, {counters['unknown']} unklar, {len(meta)} meta")


if __name__ == "__main__":
    main()
