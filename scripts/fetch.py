"""Laedt alle Quellen aus sources.yaml nach data/raw/.

Native Google Sheets: htmlview-Route pro Tab (behaelt Links + Bild-URLs).
Drive-Dateien (type: drive_xlsx): direkter Download.
Quellen mit auth: true werden ueber eine gespeicherte Browser-Session geladen
(erster Lauf oeffnet ein Chrome-Fenster fuer den Google-Login, danach headless).
Manuell abgelegte Dateien in data/manual/ liest parse.py direkt.
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
PROFILE = ROOT / "data" / "browser-profile"

TAB_RE = re.compile(r'items\.push\(\{name: "((?:[^"\\]|\\.)*)", pageUrl: "([^"]*)"')


class Resp:
    """Vereinheitlichte Antwort fuer requests- und Playwright-Backends."""

    def __init__(self, status_code, headers, content, url):
        self.status_code = status_code
        self.headers = {k.lower(): v for k, v in headers.items()}
        self.content = content
        self.url = url

    @property
    def text(self):
        return self.content.decode("utf-8", errors="replace")


class RequestsHTTP:
    def __init__(self):
        self.s = requests.Session()

    def get(self, url, timeout=120):
        r = self.s.get(url, timeout=timeout)
        return Resp(r.status_code, dict(r.headers), r.content, r.url)


class BrowserHTTP:
    """Playwright persistent context mit System-Chrome; Login-Session bleibt im Profil."""

    def __init__(self):
        from playwright.sync_api import sync_playwright

        self._pw = sync_playwright().start()
        self.ctx = None
        self.visible = False
        self._launch(headless=True)

    def _launch(self, headless):
        if self.ctx:
            self.ctx.close()
        self.ctx = self._pw.chromium.launch_persistent_context(
            str(PROFILE), channel="chrome", headless=headless
        )
        self.visible = not headless

    def ensure_login(self, test_sheet_id):
        url = f"https://docs.google.com/spreadsheets/d/{test_sheet_id}/htmlview"
        r = self.get(url)
        if r.status_code == 200 and "accounts.google" not in r.url:
            return True
        print("Login noetig - Chrome-Fenster geht auf. Bei Google einloggen ...")
        self._launch(headless=False)
        page = self.ctx.new_page()
        page.goto(url, timeout=120_000)
        try:
            page.wait_for_selector("#sheets-viewport, table", timeout=300_000)
        except Exception:
            return False
        print("Login erkannt, weiter.")
        page.close()
        return True

    def get(self, url, timeout=120):
        r = self.ctx.request.get(url, timeout=timeout * 1000)
        return Resp(r.status, r.headers, r.body(), r.url)

    def close(self):
        try:
            self.ctx.close()
            self._pw.stop()
        except Exception:
            pass


def get_tabs(http, sheet_id):
    r = http.get(f"https://docs.google.com/spreadsheets/d/{sheet_id}/htmlview")
    if r.status_code != 200 or "accounts.google" in r.url:
        raise RuntimeError(f"htmlview HTTP {r.status_code}")
    title_m = re.search(r"<title>(.*?)</title>", r.text, re.S)
    title = title_m.group(1).strip() if title_m else sheet_id
    for suf in (" - Google Tabellen", " - Google Sheets", " - Google Drive"):
        title = title.removesuffix(suf)
    title = title.strip()
    tabs = []
    for m in TAB_RE.finditer(r.text):
        name = m.group(1).replace("\\/", "/").encode().decode("unicode_escape")
        g = re.search(r"gid(?:%3D|=)(\d+)", m.group(2).replace("\\/", "/"))
        if g:
            tabs.append({"name": name, "gid": g.group(1)})
    if not tabs:
        # Sheet mit nur einem Tab: htmlview zeigt keinen Tab-Switcher
        tabs = [{"name": title, "gid": "0"}]
    return title, tabs


def fetch_gsheet(http, sheet_id):
    title, tabs = get_tabs(http, sheet_id)
    fetched = []
    for t in tabs:
        r = http.get(
            f"https://docs.google.com/spreadsheets/d/{sheet_id}/htmlview/sheet"
            f"?headers=false&gid={t['gid']}",
            timeout=300,
        )
        if r.status_code == 200 and "html" in r.headers.get("content-type", ""):
            (RAW / f"{sheet_id}__{t['gid']}.html").write_bytes(r.content)
            fetched.append({**t, "bytes": len(r.content)})
        else:
            fetched.append({**t, "error": f"HTTP {r.status_code}"})
    return {"id": sheet_id, "ok": True, "title": title, "type": "gsheet", "tabs": fetched}


def fetch_drive_xlsx(http, sheet_id):
    r = http.get(f"https://drive.google.com/uc?export=download&id={sheet_id}", timeout=600)
    if r.status_code != 200 or "html" in r.headers.get("content-type", ""):
        return {"id": sheet_id, "ok": False, "error": f"HTTP {r.status_code}"}
    (RAW / f"{sheet_id}.xlsx").write_bytes(r.content)
    return {"id": sheet_id, "ok": True, "type": "drive_xlsx", "bytes": len(r.content)}


def fetch_one(http, s):
    sid = s["id"]
    try:
        if s.get("type") == "drive_xlsx":
            res = fetch_drive_xlsx(http, sid)
        else:
            res = fetch_gsheet(http, sid)
    except Exception as e:
        res = {"id": sid, "ok": False, "error": str(e)[:200]}
    res["name"] = s.get("name", res.get("title", sid))
    tab_errors = [t for t in res.get("tabs", []) if t.get("error")]
    if res["ok"] and res.get("tabs") and len(tab_errors) == len(res["tabs"]):
        res["ok"] = False
        res["error"] = f"alle Tabs fehlgeschlagen ({tab_errors[0]['error']})"
    tag = "ok  " if res["ok"] else "FAIL"
    extra = f"{len(res.get('tabs', []))} tabs" if res.get("tabs") else res.get("error", "")
    if tab_errors and res["ok"]:
        extra += f" ({len(tab_errors)} Tab-Fehler)"
    print(f"[{tag}] {sid[:14]}... {str(res['name'])[:40]}  {extra}")
    return res


def main():
    cfg = yaml.safe_load((ROOT / "sources.yaml").read_text(encoding="utf-8"))
    plain = [s for s in cfg["sources"] if not s.get("auth")]
    authed = [s for s in cfg["sources"] if s.get("auth")]

    results = []
    http = RequestsHTTP()
    for s in plain:
        results.append(fetch_one(http, s))

    if authed:
        browser = BrowserHTTP()
        try:
            if browser.ensure_login(authed[0]["id"]):
                for s in authed:
                    results.append(fetch_one(browser, s))
            else:
                for s in authed:
                    results.append({"id": s["id"], "ok": False, "name": s.get("name", s["id"]),
                                    "error": "Login nicht abgeschlossen"})
                print("[FAIL] Auth-Quellen uebersprungen - Login nicht abgeschlossen.")
        finally:
            browser.close()

    (ROOT / "data" / "fetch_report.json").write_text(
        json.dumps(results, indent=1, ensure_ascii=False), encoding="utf-8"
    )
    fails = [r for r in results if not r["ok"]]
    print(f"\n{len(results) - len(fails)}/{len(results)} ok")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
