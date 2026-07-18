"""Prueft Kandidaten-Sheet-IDs: erreichbar? Tabs? Kauf-Links? Jahres-Hinweise?

Aufruf: python check_sources.py ID1 ID2 ...  (oder IDs zeilenweise via stdin)
"""
import re
import sys

import requests

TAB_RE = re.compile(r'items\.push\(\{name: "((?:[^"\\]|\\.)*)", pageUrl: "([^"]*)"')
SHOP_RE = re.compile(
    r"weidian\.com|taobao\.com|1688\.com|kakobuy|cnfans|mulebuy|acbuy|oopbuy|hoobuy|"
    r"joyagoo|superbuy|cssbuy|allchinabuy|basetao|orientdig|lovegobuy|ootdbuy|loongbuy|"
    r"ponybuy|itaobuy|sifubuy|hipobuy|eastmallbuy|sugargoo"
)


def check(sid, session):
    try:
        r = session.get(f"https://docs.google.com/spreadsheets/d/{sid}/htmlview", timeout=60)
    except requests.RequestException as e:
        return {"id": sid, "status": f"ERR {str(e)[:40]}"}
    if r.status_code != 200 or "accounts.google" in r.url:
        return {"id": sid, "status": f"HTTP {r.status_code} (privat?)"}
    title_m = re.search(r"<title>(.*?)</title>", r.text, re.S)
    title = title_m.group(1).strip() if title_m else "?"
    for suf in (" - Google Tabellen", " - Google Sheets", " - Google Drive"):
        title = title.removesuffix(suf)
    tabs = TAB_RE.findall(r.text)
    gid0 = session.get(
        f"https://docs.google.com/spreadsheets/d/{sid}/htmlview/sheet?headers=false"
        f"&gid={re.search(r'gid(?:%3D|=)(\d+)', tabs[0][1].replace(chr(92)+'/', '/')).group(1) if tabs and re.search(r'gid(?:%3D|=)(\d+)', tabs[0][1].replace(chr(92)+'/', '/')) else '0'}",
        timeout=120,
    )
    shoplinks = len(SHOP_RE.findall(gid0.text)) if gid0.status_code == 200 else -1
    y2026 = len(re.findall(r"2026", gid0.text)) if gid0.status_code == 200 else 0
    return {"id": sid, "status": "OK", "title": title[:44], "tabs": max(len(tabs), 1),
            "links_tab1": shoplinks, "hits_2026": y2026}


def main():
    ids = sys.argv[1:] or [l.strip() for l in sys.stdin if l.strip()]
    s = requests.Session()
    for sid in ids:
        r = check(sid, s)
        if r["status"] == "OK":
            print(f"OK   {r['id']}  tabs={r['tabs']:3d} links={r['links_tab1']:5d} 2026={r['hits_2026']:3d}  {r['title']}")
        else:
            print(f"FAIL {r['id']}  {r['status']}")


if __name__ == "__main__":
    main()
