"""Extrahiert Items aus data/raw/ (HTML-Tabs + xlsx) und data/manual/ (xlsx) nach site/items.json.

Heuristik: Zelle mit Kauf-Link = Item-Anker; Name/Preis/Bild aus Nachbarzellen
derselben Zeile; Kategorie aus Tab-Name, Abschnitts-Headern und Namens-Keywords.
"""
import html as htmllib
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import openpyxl
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
MANUAL = ROOT / "data" / "manual"
OUT = ROOT / "site" / "items.json"

# Kauf-Link-Domains (Agenten + Marktplaetze)
SHOP_HOSTS = (
    "weidian.com", "taobao.com", "tmall.com", "1688.com", "yupoo.com",
    "kakobuy.com", "sugargoo.com", "cnfans.com", "mulebuy.com", "acbuy.com",
    "superbuy.com", "cssbuy.com", "hipobuy.com", "joyagoo.com", "pandabuy.com",
    "hagobuy.com", "allchinabuy.com", "oopbuy.com", "orientdig.com",
    "hoobuy.com", "loongbuy.com", "ponybuy.com", "basetao.com", "wegobuy.com",
    "itaobuy.com", "sifubuy.com", "eastmallbuy.com", "usfans.com", "lovegobuy.com",
    "ootdbuy.com", "panglobalbuy.com", "bbdbuy.com", "gjbuy.com", "vigorbuy.com",
)

PRICE_RE = re.compile(
    r"(?:[$€£¥￥]\s?\d[\d.,]*|\d[\d.,]*\s?(?:USD|EUR|CNY|RMB|GBP|\$|€|¥|￥)|(?:USD|EUR|CNY|RMB|GBP)\s?\d[\d.,]*)",
    re.I,
)
HYPERLINK_RE = re.compile(r'HYPERLINK\(\s*""?"?([^"]+?)""?"?\s*[,)]', re.I)
IMAGE_RE = re.compile(r'IMAGE\(\s*""?"?(https?://[^"]+?)""?"?\s*[,)]', re.I)
URL_RE = re.compile(r"https?://[^\s\"'<>)]+")

AGENTS = (
    "kakobuy|sugargoo|cnfans|mulebuy|acbuy|superbuy|cssbuy|hipobuy|joyagoo|pandabuy|"
    "hagobuy|allchinabuy|oopbuy|orientdig|hoobuy|loongbuy|ponybuy|basetao|wegobuy|"
    "itaobuy|sifubuy|eastmallbuy|usfans|lovegobuy|ootdbuy|panglobalbuy|bbdbuy|gjbuy|"
    "vigorbuy|weidian|taobao|tmall|1688|yupoo"
)
BAD_NAME = re.compile(
    r"^(link|links|click|click here|here|raw link|buy|photo|photos|picture|pic|image|img|qc|view|"
    r"name|names|item name|price|prices|\W*|\w+ links?|(" + AGENTS + r")( links?)?)$",
    re.I,
)
NOISE_NAME = re.compile(
    r"discord|instagram|tiktok|youtube|reddit|sign up|coupon|tutorial|how to|join|follow|subscribe|free \$|% off|click here|spreadsheet|ctrl\s*\+\s*f|telegram|whatsapp|converter",
    re.I,
)

CATEGORIES = [
    ("Schuhe", r"shoe|sneaker|slide|slipper|sandal|boot|loafer|trainer|dunk|jordan|\baj\d|af1|airmax|air max|yeezy|new balance|bapesta|\bsb\b|foam|croc|heel|mule|birkenstock|samba|gazelle|campus|3xl|b30|b22|b27|tabi"),
    ("Trikots", r"jersey|jerseys|trikot|#\d+ |city edition|nba|nfl|soccer|football kit"),
    ("Shirts & Tees", r"\btee\b|tees|t-?shirt|shirt|polo|longsleeve|long sleeve|vest|tank"),
    ("Hoodies & Sweater", r"hoodie|sweater|sweatshirt|crewneck|zip|cardigan|knit|fleece|pullover"),
    ("Jacken", r"jacket|jackets|puffer|coat|parka|windbreaker|varsity|denim jacket|bomber|monclair|moncler"),
    ("Hosen & Shorts", r"pant|pants|jean|jeans|short|shorts|sweatpant|trouser|cargo|tracksuit|track suit|leggings|boxers|underwear|undies"),
    ("Taschen", r"\bbag\b|bags|backpack|tote|crossbody|messenger|duffle|wallet|cardholder|card holder|pouch|carpenter"),
    ("Uhren", r"watch|watches|rolex|relox|royal oak|richard|patek|omega|cartier santos|datejust|submariner|nautilus"),
    ("Schmuck & Accessoires", r"jewel|rings?\b|necklace|pendant|chain|bracelet|earring|belt|caps?\b|hats?\b|beanie|sunglass|glasses|scarf|glove|sock|accessor|keychain|airpods case|phone case"),
    ("Parfum", r"parfum|perfume|cologne|fragrance|tom ford|dior sauvage|creed"),
    ("Elektronik", r"electronic|airpods|iphone|ipad|samsung|dyson|bose|\bjbl\b|sony|beats|marshall|jabra|headphone|earbud|speaker|playstation|controller|lego|philips|shure|console|smartwatch"),
]


def norm_text(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", str(s))
    return re.sub(r"\s+", " ", s).strip()


def real_url(u):
    """google.com/url-Redirect aufloesen."""
    u = htmllib.unescape(u)
    if "google.com/url" in u:
        q = parse_qs(urlparse(u).query).get("q", [u])[0]
        u = unquote(q)
    return u.strip()


def is_shop_link(u):
    try:
        host = urlparse(u).netloc.lower()
    except ValueError:
        return False
    return any(host == h or host.endswith("." + h) for h in SHOP_HOSTS)


def dedup_key(u):
    """Produkt-URL aus Agent-Wrappern ziehen, damit gleiche Items matchen."""
    inner = None
    try:
        qs = parse_qs(urlparse(u).query)
    except ValueError:
        return u
    for k in ("productLink", "url", "goodsUrl", "product_link", "link"):
        if k in qs and qs[k] and qs[k][0].startswith("http"):
            inner = unquote(qs[k][0])
            break
    target = inner or u
    try:
        p = urlparse(target)
        iq = parse_qs(p.query)
        for k in ("itemID", "itemId", "id"):
            if k in iq:
                return f"{p.netloc.lower()}::{iq[k][0]}"
        return f"{p.netloc.lower()}{p.path}".rstrip("/")
    except ValueError:
        return target


def categorize(*texts):
    blob = " ".join(t.lower() for t in texts if t)
    for cat, pat in CATEGORIES:
        if re.search(pat, blob):
            return cat
    return "Sonstiges"


def is_pricey(t):
    """Zelle besteht im Wesentlichen aus Preisangaben (auch mehrwaehrig mit | getrennt)."""
    if not t or not PRICE_RE.search(t):
        return False
    rest = PRICE_RE.sub("", t)
    rest = re.sub(r"[|｜/\\\s.,~\-–—()]+", "", rest)
    return len(rest) <= 3


def good_name(t, cell=None):
    if not t or len(t) < 3 or len(t) > 160:
        return False
    if cell is not None and cell.get("url"):
        return False
    if BAD_NAME.match(t) or NOISE_NAME.search(t):
        return False
    if t.startswith("http") or URL_RE.search(t):
        return False
    if re.fullmatch(r"[\d.,\s]+", t) or is_pricey(t) or PRICE_RE.fullmatch(t):
        return False
    if re.fullmatch(r"\d+[.,]?\d*\s?(g|kg|ml|cm|mm)", t, re.I):
        return False
    if re.fullmatch(r"\(?\s*\d*\s*\+?\s*(colou?r\s*ways?|colorways?|colou?rs?|styles?|versions?)\s*\)?", t, re.I):
        return False
    return True


def looks_like_header(cells_with_text):
    """Abschnitts-Header: 1-3 kurze Textzellen, keine Links, kein Preis."""
    if not (1 <= len(cells_with_text) <= 3):
        return None
    for t in cells_with_text:
        if len(t) > 40 or PRICE_RE.search(t) or NOISE_NAME.search(t):
            return None
    return " / ".join(cells_with_text)


def extract_items(grid, source_name, tab_name):
    """grid: Liste von Zeilen; Zelle = dict(text, url, img)."""
    items = []
    section = ""
    for r, row in enumerate(grid):
        texted = [c["text"] for c in row if c["text"]]
        linked = [c for c in row if c.get("url")]
        if not linked:
            hdr = looks_like_header(texted)
            if hdr:
                section = hdr
            continue
        prev = grid[r - 1] if r > 0 else []
        for idx, cell in enumerate(row):
            u = cell.get("url")
            if not u:
                continue
            # Name: Zelle selbst -> links -> rechts -> Zeile drueber (gleiche Spalte +-1)
            name = ""
            if good_name(cell["text"]):
                name = cell["text"]
            if not name:
                for j in range(idx - 1, max(-1, idx - 5), -1):
                    if 0 <= j < len(row) and good_name(row[j]["text"], row[j]):
                        name = row[j]["text"]
                        break
            if not name:
                for j in range(idx + 1, min(len(row), idx + 4)):
                    if good_name(row[j]["text"], row[j]) and not PRICE_RE.search(row[j]["text"]):
                        name = row[j]["text"]
                        break
            if not name and prev:
                for j in (idx, idx - 1, idx + 1):
                    if 0 <= j < len(prev) and good_name(prev[j]["text"], prev[j]):
                        name = prev[j]["text"]
                        break
            if not name:
                continue
            name = re.sub(r"^\d+\s*[、．.)]\s*", "", name).strip() or name
            # Preis: preisdominante Nachbarzellen, sonst Zeile drueber
            price = ""
            for j in range(max(0, idx - 4), min(len(row), idx + 5)):
                t = row[j]["text"]
                if t and t != name and is_pricey(t):
                    price = norm_text(t)[:44]
                    break
            if not price and prev:
                for j in range(max(0, idx - 2), min(len(prev), idx + 3)):
                    t = prev[j]["text"]
                    if t and t != name and is_pricey(t):
                        price = norm_text(t)[:44]
                        break
            # Bild: Zelle selbst, Nachbarn, dann Zeile drueber/drunter
            img = cell.get("img") or ""
            if not img:
                for j in range(max(0, idx - 3), min(len(row), idx + 4)):
                    if row[j].get("img"):
                        img = row[j]["img"]
                        break
            if not img:
                for adj in (prev, grid[r + 1] if r + 1 < len(grid) else []):
                    for j in range(max(0, idx - 2), min(len(adj), idx + 3)):
                        if adj[j].get("img"):
                            img = adj[j]["img"]
                            break
                    if img:
                        break
            items.append({
                "n": name[:120],
                "p": price,
                "c": categorize(tab_name, section, name),
                "i": img,
                "u": u,
                "s": source_name,
                "t": norm_text(tab_name)[:40],
            })
    return items


def grid_from_html(path):
    soup = BeautifulSoup(path.read_text(encoding="utf-8", errors="replace"), "lxml")
    grid = []
    for tr in soup.find_all("tr"):
        row = []
        for td in tr.find_all("td"):
            a = td.find("a", href=True)
            url = None
            if a:
                cand = real_url(a["href"])
                if is_shop_link(cand):
                    url = cand
            img = td.find("img", src=True)
            row.append({
                "text": norm_text(td.get_text(" ")),
                "url": url,
                "img": img["src"] if img else None,
            })
        if row:
            grid.append(row)
    return grid


def grid_from_xlsx(path):
    wb = openpyxl.load_workbook(path, data_only=False)
    tabs = {}
    for ws in wb.worksheets:
        if ws.max_row is None or ws.max_row < 2:
            continue
        hyper = {}
        for hl in ws._hyperlinks:
            if hl.target:
                hyper[hl.ref] = hl.target
        grid = []
        for r, wsrow in enumerate(ws.iter_rows(), start=1):
            row = []
            for c, cell in enumerate(wsrow, start=1):
                v = cell.value
                text, url, img = "", None, None
                if v is not None:
                    v = str(v)
                    if m := HYPERLINK_RE.search(v):
                        url = htmllib.unescape(m.group(1).replace('""', '"'))
                    if m := IMAGE_RE.search(v):
                        img = m.group(1).replace('""', '"')
                    if not v.startswith("="):
                        text = norm_text(v)
                        if not url and (m := URL_RE.search(v)):
                            url = m.group(0)
                ref = f"{cell.coordinate}"
                if ref in hyper:
                    url = hyper[ref]
                if url:
                    url = real_url(url)
                    if not is_shop_link(url):
                        url = None
                row.append({"text": text, "url": url, "img": img})
            grid.append(row)
        tabs[ws.title] = grid
    wb.close()
    return tabs


def main():
    report = json.loads((ROOT / "data" / "fetch_report.json").read_text(encoding="utf-8"))
    names = {r["id"]: r.get("name", r["id"]) for r in report}
    tabnames = {}
    for r in report:
        for t in r.get("tabs", []):
            tabnames[(r["id"], t["gid"])] = t["name"]

    all_items = []
    per_source = {}

    for f in sorted(RAW.glob("*.html")):
        sid, gid = f.stem.rsplit("__", 1)
        src = names.get(sid, sid)
        tab = tabnames.get((sid, gid), gid)
        items = extract_items(grid_from_html(f), src, tab)
        all_items.extend(items)
        per_source[src] = per_source.get(src, 0) + len(items)

    xlsx_files = list(RAW.glob("*.xlsx")) + (list(MANUAL.glob("*.xlsx")) if MANUAL.exists() else [])
    for f in xlsx_files:
        src = names.get(f.stem, f.stem)
        for tab, grid in grid_from_xlsx(f).items():
            items = extract_items(grid, src, tab)
            all_items.extend(items)
            per_source[src] = per_source.get(src, 0) + len(items)

    # Dedup: gleiche Produkt-URL innerhalb gleicher Quelle
    seen = {}
    unique = []
    for it in all_items:
        key = (it["s"], dedup_key(it["u"]))
        if key in seen:
            prev = seen[key]
            if not prev["i"] and it["i"]:
                prev["i"] = it["i"]
            if not prev["p"] and it["p"]:
                prev["p"] = it["p"]
            continue
        seen[key] = it
        unique.append(it)

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(unique, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"items total={len(all_items)} unique={len(unique)}  -> {OUT} ({OUT.stat().st_size // 1024} KB)")
    for src, n in sorted(per_source.items(), key=lambda x: -x[1]):
        print(f"  {src}: {n}")
    from collections import Counter
    print("Kategorien:", dict(Counter(i['c'] for i in unique).most_common()))


if __name__ == "__main__":
    main()
