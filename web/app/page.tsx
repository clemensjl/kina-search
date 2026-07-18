"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AGENTS, QCDBS, agentLink, itemKey, rawUrl, type Item } from "@/lib/agents";
import { eurOf, fmtCNY, fmtEUR, fold, loadDb, type Rates } from "@/lib/data";
import UserBar from "@/components/UserBar";

const BATCH = 120;
const VERIFIED = "Von uns verifiziert";
const CAT_ORDER = [
  VERIFIED, "Schuhe", "Shirts & Tees", "Hoodies & Sweater", "Jacken", "Hosen & Shorts",
  "Trikots", "Taschen", "Uhren", "Schmuck & Accessoires", "Parfum", "Elektronik", "Sonstiges",
];

// grobe clientseitige Variante von parse.extract_ref fuer eingereichte URLs
function parseRef(u: string): { pf?: Item["pf"]; pid?: string } {
  try {
    const url = new URL(u);
    const q = url.searchParams;
    const inner = q.get("url") || q.get("productLink");
    if (inner && /^https?:/.test(inner)) return parseRef(decodeURIComponent(inner));
    const host = url.hostname;
    if (host.includes("weidian.com")) {
      const id = q.get("itemID") || q.get("itemId") || q.get("id");
      if (id) return { pf: "wd", pid: id };
    }
    if (host.includes("taobao.com") || host.includes("tmall.com")) {
      const id = q.get("id");
      if (id) return { pf: "tb", pid: id };
    }
    if (host.includes("1688.com")) {
      const m = url.pathname.match(/\/offer\/(\d+)/);
      if (m) return { pf: "al", pid: m[1] };
    }
    const id = q.get("id");
    const plat = (q.get("shop_type") || q.get("platform") || q.get("channel") || q.get("source") || "").toLowerCase();
    if (id && plat) {
      if (plat.startsWith("weidian") || plat.startsWith("wd")) return { pf: "wd", pid: id };
      if (plat.startsWith("taobao") || plat.startsWith("tb")) return { pf: "tb", pid: id };
      if (plat.includes("1688") || plat.startsWith("al")) return { pf: "al", pid: id };
    }
  } catch { /* keine URL */ }
  return {};
}

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [rates, setRates] = useState<Rates>({ CNY: 7.8, USD: 1.08, GBP: 0.85, EUR: 1 });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [cat, setCat] = useState("");
  const [src, setSrc] = useState("");
  const [sort, setSort] = useState("rel");
  const [shown, setShown] = useState(BATCH);
  const [modal, setModal] = useState<Item | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const debRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const db = await loadDb();
        let extra: Item[] = [];
        try {
          type VerRow = { name: string; url: string; price?: string; category?: string; image_url?: string; rating: number; note?: string };
          type SubRow = { name: string; url: string; price?: string; category: string; image_url?: string };
          const [ver, subs] = await Promise.all([
            fetch("/api/verified").then((r) => (r.ok ? (r.json() as Promise<VerRow[]>) : [])),
            fetch("/api/submissions?scope=approved").then((r) => (r.ok ? (r.json() as Promise<SubRow[]>) : [])),
          ]);
          extra = [
            ...ver.map((v) => ({
              n: v.name, b: "", c: v.category || VERIFIED, i: v.image_url || "",
              s: VERIFIED, p: v.price || "", u: v.url, ...parseRef(v.url),
              verified: { rating: Number(v.rating), note: v.note || "" },
            })),
            ...subs.map((s) => ({
              n: s.name, b: "", c: s.category, i: s.image_url || "",
              s: "Community", p: s.price || "", u: s.url, ...parseRef(s.url),
            })),
          ];
          for (const it of extra) it._h = fold(`${it.n} ${it.c} ${it.s}`);
          const col = await fetch("/api/collections");
          if (col.ok) {
            const { items: ci } = (await col.json()) as { items: { item_key: string }[] };
            setSavedKeys(new Set(ci.map((r) => r.item_key)));
          }
        } catch { /* User-Daten optional - statische Daten reichen */ }
        setItems([...extra, ...db.items]);
        setRates(db.rates);
        setLoaded(true);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  const view = useMemo(() => {
    const toks = fold(qLive.trim()).split(/\s+/).filter(Boolean);
    let v = items.filter((it) => {
      if (cat === VERIFIED) { if (!it.verified) return false; }
      else if (cat && it.c !== cat) return false;
      if (src && it.s !== src) return false;
      if (toks.length) {
        const hay = it._h || "";
        for (const t of toks) if (!hay.includes(t)) return false;
      }
      return true;
    });
    if (sort === "name") v = [...v].sort((a, b) => a.n.localeCompare(b.n, "de"));
    else if (sort === "pa" || sort === "pd") {
      const dir = sort === "pa" ? 1 : -1;
      v = [...v].sort((a, b) => {
        const x = eurOf(a, rates), y = eurOf(b, rates);
        if (isNaN(x) && isNaN(y)) return 0;
        if (isNaN(x)) return 1;
        if (isNaN(y)) return -1;
        return (x - y) * dir;
      });
    }
    return v;
  }, [items, qLive, cat, src, sort, rates]);

  useEffect(() => { setShown(BATCH); }, [qLive, cat, src, sort]);

  const onSearch = useCallback((val: string) => {
    setQ(val);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setQLive(val), 90);
  }, []);

  const priceLabel = useCallback((it: Item): string => {
    const eur = eurOf(it, rates);
    return isNaN(eur) ? it.p || "" : fmtEUR(eur);
  }, [rates]);

  async function toggleSave(it: Item) {
    const key = itemKey(it);
    const r = await fetch("/api/collections/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        item_key: key, item_name: it.n, item_image: it.i || "", item_price: priceLabel(it),
      }),
    });
    if (r.status === 401) { window.location.href = "/login"; return; }
    if (!r.ok) return;
    const { saved } = await r.json();
    setSavedKeys((p) => {
      const n = new Set(p);
      if (saved) n.add(key); else n.delete(key);
      return n;
    });
  }

  const cats = useMemo(() => {
    const present = new Set(items.map((i) => i.c));
    const hasVerified = items.some((i) => i.verified);
    return CAT_ORDER.filter((c) => (c === VERIFIED ? hasVerified : present.has(c)));
  }, [items]);
  const sources = useMemo(() => [...new Set(items.map((i) => i.s))].sort(), [items]);

  return (
    <>
      <header className="site">
        <div className="head-inner">
          <div className="head-top">
            <h1 className="logo"><a href="/">Kina<span className="tick">/</span>Search</a></h1>
            <div className="manifest">
              <b>{view.length.toLocaleString("de-AT")}</b> Treffer · {items.length.toLocaleString("de-AT")} Artikel
            </div>
            <UserBar />
          </div>
          <div className="searchrow">
            <input id="q" type="search" placeholder="Suchen: Marke, Item, Kategorie …"
              autoComplete="off" value={q} onChange={(e) => onSearch(e.target.value)} />
            <select value={src} onChange={(e) => setSrc(e.target.value)} aria-label="Quelle">
              <option value="">Alle Quellen</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sortierung">
              <option value="rel">Sortierung: Marke</option>
              <option value="pa">Preis aufsteigend</option>
              <option value="pd">Preis absteigend</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
          <div className="chips" role="tablist" aria-label="Kategorie">
            <button className={`chip${cat === "" ? " on" : ""}`} onClick={() => setCat("")}>Alle</button>
            {cats.map((c) => (
              <button key={c}
                className={`chip${c === VERIFIED ? " vchip" : ""}${cat === c ? " on" : ""}`}
                onClick={() => setCat(cat === c ? "" : c)}>{c}</button>
            ))}
          </div>
        </div>
      </header>

      <main className="wrap">
        {!loaded && !error && <div className="loading">Lade 100.000+ Artikel …</div>}
        {error && <div className="notice err">Daten konnten nicht geladen werden: {error}</div>}
        {loaded && view.length === 0 && (
          <div className="empty">
            <div className="big">Kein Treffer</div>
            Anderen Suchbegriff versuchen oder Filter zurücksetzen.
          </div>
        )}
        {loaded && view.length > 0 && (
          <div id="grid">
            {view.slice(0, shown).map((it, i) => (
              <Card key={itemKey(it) + i} it={it} price={priceLabel(it)}
                saved={savedKeys.has(itemKey(it))}
                onOpen={() => setModal(it)} onSave={() => toggleSave(it)} />
            ))}
          </div>
        )}
        {loaded && shown < view.length && (
          <button className="morebtn" onClick={() => setShown((s) => s + BATCH)}>Mehr laden</button>
        )}
      </main>

      <footer className="site">
        Kina Search – aggregiert aus 75 Spreadsheets plus Community-Einreichungen.
        Preise wie in der Quelle angegeben, ohne Gewähr. Links öffnen extern.
      </footer>

      {modal && <Modal it={modal} rates={rates} saved={savedKeys.has(itemKey(modal))}
        onSave={() => toggleSave(modal)} onClose={() => setModal(null)} />}
    </>
  );
}

function Card({ it, price, saved, onOpen, onSave }: {
  it: Item; price: string; saved: boolean; onOpen: () => void; onSave: () => void;
}) {
  const initials = (it.b || it.n).replace(/[^A-Za-z0-9 ]/g, "").split(" ")
    .filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return (
    <a className="card" href={rawUrl(it)} target="_blank" rel="noopener noreferrer"
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault(); onOpen();
      }}>
      <div className="thumb">
        <div className="ph">{initials}</div>
        {it.verified && <span className="vbadge">★ {it.verified.rating.toFixed(1)}</span>}
        <button className={`savebtn${saved ? " saved" : ""}`} aria-label="Speichern" type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSave(); }}>
          {saved ? "✓" : "+"}
        </button>
        {it.i && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={it.i} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
            onError={(e) => e.currentTarget.remove()}
            onLoad={(e) => e.currentTarget.parentElement?.querySelector(".ph")?.remove()} />
        )}
      </div>
      <div className="card-body">
        <div className="name">{it.n}</div>
        <div className="meta">
          <span className="price">{price}</span>
          <span className="src">{it.s}</span>
        </div>
      </div>
    </a>
  );
}

function Modal({ it, rates, saved, onSave, onClose }: {
  it: Item; rates: Rates; saved: boolean; onSave: () => void; onClose: () => void;
}) {
  useEffect(() => {
    document.body.classList.add("modal-open");
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => {
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const eur = eurOf(it, rates);
  const raw = rawUrl(it);
  const platLabel = it.pf === "wd" ? "Original (Weidian)" : it.pf === "tb" ? "Original (Taobao)"
    : it.pf === "al" ? "Original (1688)" : "Original-Link";

  return (
    <div className="modal-back" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-label={it.n}>
        <button className="modal-close" onClick={onClose} aria-label="Schliessen">×</button>
        <div className="modal-grid">
          <div className="modal-img">
            {it.i ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={it.i} alt="" referrerPolicy="no-referrer" />
            ) : (
              <div className="ph">{(it.b || it.n).slice(0, 2).toUpperCase()}</div>
            )}
          </div>
          <div className="modal-info">
            <div className="modal-brand">{it.b || (it.verified ? "Von uns verifiziert" : "Ohne Marke")}</div>
            <div className="modal-name">{it.n}</div>
            <div className="modal-price">
              {!isNaN(eur) ? (
                <>
                  <span className="eur">{fmtEUR(eur)}</span>
                  <span className="cny">{fmtCNY(eur * rates.CNY)}</span>
                </>
              ) : it.p ? (
                <span className="eur" style={{ fontSize: 18 }}>{it.p}</span>
              ) : (
                <span className="cny">Preis in der Quelle nicht angegeben</span>
              )}
            </div>
            <div className="modal-meta">{[it.c, it.s].filter(Boolean).join("  ·  ")}</div>
            {it.verified && (
              <div className="vnote">
                <div className="vr">★ {it.verified.rating.toFixed(1)} / 10 – von uns getestet</div>
                {it.verified.note && <p>{it.verified.note}</p>}
              </div>
            )}
            <button className="smallbtn" onClick={onSave} style={{ marginBottom: 4 }}>
              {saved ? "✓ Gespeichert" : "+ In Collection speichern"}
            </button>
            {raw && (
              <>
                <div className="mod-sec">{platLabel}</div>
                <a className="orig-btn" href={raw} target="_blank" rel="noopener noreferrer">Produkt öffnen</a>
              </>
            )}
            <div className="mod-sec">Bei Agent öffnen</div>
            <div className="linkgrid">
              {AGENTS.map((ag) => {
                const href = agentLink(ag, it);
                if (!href) return null;
                return (
                  <a key={ag.n} href={href} target="_blank" rel="noopener noreferrer"
                    className={ag.fav ? "fav" : undefined}>
                    {ag.fav ? `★ ${ag.n}` : ag.n}
                  </a>
                );
              })}
            </div>
            {raw && (
              <>
                <div className="mod-sec">QC-Fotos suchen</div>
                <div className="linkgrid">
                  {QCDBS.map((qc) => {
                    const href = agentLink(qc, it);
                    if (!href) return null;
                    return <a key={qc.n} href={href} target="_blank" rel="noopener noreferrer">{qc.n}</a>;
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
