"""Laedt alle Quellen aus sources.yaml nach data/raw/.

Native Google Sheets: htmlview-Route pro Tab (behaelt Links + Bild-URLs).
Drive-Dateien (type: drive_xlsx): direkter Download.
Manuell abgelegte Dateien in data/manual/ werden von parse.py direkt gelesen.
"""
import json
import re
import sys
from pathlib import Path

import requests
import yaml

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)

TAB_RE = re.compile(r'items\.push\(\{name: "((?:[^"\\]|\\.)*)", pageUrl: "([^"]*)"')


def get_tabs(session, sheet_id):
    r = session.get(
        f"https://docs.google.com/spreadsheets/d/{sheet_id}/htmlview", timeout=120
    )
    if r.status_code != 200:
        raise RuntimeError(f"htmlview HTTP {r.status_code}")
    title_m = re.search(r"<title>(.*?)</title>", r.text, re.S)
    title = (title_m.group(1).strip() if title_m else sheet_id).removesuffix(" - Google Tabellen").removesuffix(" - Google Sheets")
    tabs = []
    for m in TAB_RE.finditer(r.text):
        name = m.group(1).encode().decode("unicode_escape")
        g = re.search(r"gid(?:%3D|=)(\d+)", m.group(2).replace("\\/", "/"))
        if g:
            tabs.append({"name": name, "gid": g.group(1)})
    if not tabs:
        # Sheet mit nur einem Tab: htmlview zeigt keinen Tab-Switcher
        tabs = [{"name": title, "gid": "0"}]
    return title, tabs


def fetch_gsheet(session, sheet_id):
    title, tabs = get_tabs(session, sheet_id)
    fetched = []
    for t in tabs:
        r = session.get(
            f"https://docs.google.com/spreadsheets/d/{sheet_id}/htmlview/sheet"
            f"?headers=false&gid={t['gid']}",
            timeout=300,
        )
        if r.status_code == 200 and "html" in r.headers.get("content-type", ""):
            out = RAW / f"{sheet_id}__{t['gid']}.html"
            out.write_bytes(r.content)
            fetched.append({**t, "bytes": len(r.content)})
        else:
            fetched.append({**t, "error": f"HTTP {r.status_code}"})
    return {"id": sheet_id, "ok": True, "title": title, "type": "gsheet", "tabs": fetched}


def fetch_drive_xlsx(session, sheet_id):
    r = session.get(
        f"https://drive.google.com/uc?export=download&id={sheet_id}", timeout=600
    )
    if r.status_code != 200 or "html" in r.headers.get("content-type", ""):
        return {"id": sheet_id, "ok": False, "error": f"HTTP {r.status_code}"}
    (RAW / f"{sheet_id}.xlsx").write_bytes(r.content)
    return {"id": sheet_id, "ok": True, "type": "drive_xlsx", "bytes": len(r.content)}


def main():
    cfg = yaml.safe_load((ROOT / "sources.yaml").read_text(encoding="utf-8"))
    session = requests.Session()
    results = []
    for s in cfg["sources"]:
        sid = s["id"]
        kind = s.get("type", "gsheet")
        try:
            if kind == "drive_xlsx":
                res = fetch_drive_xlsx(session, sid)
            else:
                res = fetch_gsheet(session, sid)
        except Exception as e:
            res = {"id": sid, "ok": False, "error": str(e)[:200]}
        res["name"] = s.get("name", res.get("title", sid))
        results.append(res)
        tab_errors = [t for t in res.get("tabs", []) if t.get("error")]
        if res["ok"] and res.get("tabs") and len(tab_errors) == len(res["tabs"]):
            res["ok"] = False
            res["error"] = f"alle Tabs fehlgeschlagen ({tab_errors[0]['error']})"
        tag = "ok  " if res["ok"] else "FAIL"
        extra = f"{len(res.get('tabs', []))} tabs" if res.get("tabs") else res.get("error", "")
        if tab_errors and res["ok"]:
            extra += f" ({len(tab_errors)} Tab-Fehler)"
        print(f"[{tag}] {sid[:14]}... {res['name'][:40]}  {extra}")
    (ROOT / "data" / "fetch_report.json").write_text(
        json.dumps(results, indent=1, ensure_ascii=False), encoding="utf-8"
    )
    fails = [r for r in results if not r["ok"]]
    print(f"\n{len(results) - len(fails)}/{len(results)} ok")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
