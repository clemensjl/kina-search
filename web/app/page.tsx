"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AGENTS, QCDBS, agentLink, itemKey, rawUrl, type Agent, type Item } from "@/lib/agents";
import { curOf, eurOf, fmtCNY, fmtCur, fold, loadDb, type Cur, type Rates } from "@/lib/data";
import { t, type Lang, type TKey } from "@/lib/i18n";
import { usePrefs, type Theme } from "@/components/Prefs";
import UserBar from "@/components/UserBar";

const BATCH = 120;
const VERIFIED = "Von uns verifiziert";
const CAT_ORDER = [
  VERIFIED, "Schuhe", "Shirts & Tees", "Hoodies & Sweater", "Jacken", "Hosen & Shorts",
  "Trikots", "Taschen", "Uhren", "Schmuck & Accessoires", "Parfum", "Elektronik", "Sonstiges",
];
const CAT_EN: Record<string, string> = {
  [VERIFIED]: "Verified by us", "Schuhe": "Shoes", "Shirts & Tees": "Shirts & Tees",
  "Hoodies & Sweater": "Hoodies & Sweaters", "Jacken": "Jackets", "Hosen & Shorts": "Pants & Shorts",
  "Trikots": "Jerseys", "Taschen": "Bags", "Uhren": "Watches",
  "Schmuck & Accessoires": "Jewelry & Accessories", "Parfum": "Fragrance",
  "Elektronik": "Electronics", "Sonstiges": "Other", "Alle": "All",
};

function agentByKey(key: string): Agent {
  return AGENTS.find((a) => a.n.toLowerCase() === key) || AGENTS[0];
}

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

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Home() {
  const { prefs, setPrefs, needsOnboarding, finishOnboarding } = usePrefs();
  const { cur, lang, theme } = prefs;
  const tr = useCallback((k: TKey) => t(lang, k), [lang]);
  const catLabel = useCallback(
    (c: string) => (lang === "en" ? CAT_EN[c] || c : c), [lang]);

  const [items, setItems] = useState<Item[]>([]);
  const [rates, setRates] = useState<Rates>({ CNY: 7.8, USD: 1.08, GBP: 0.85, EUR: 1 });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [cat, setCat] = useState("");
  const [sort, setSort] = useState("rel");
  const [pmin, setPmin] = useState("");
  const [pmax, setPmax] = useState("");
  const [shuffleSeed, setShuffleSeed] = useState(0);
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
              p: v.price || "", u: v.url, ...parseRef(v.url),
              verified: { rating: Number(v.rating), note: v.note || "" },
            })),
            ...subs.map((s) => ({
              n: s.name, b: "", c: s.category, i: s.image_url || "",
              p: s.price || "", u: s.url, ...parseRef(s.url),
            })),
          ];
          for (const it of extra) it._h = fold(`${it.n} ${it.c}`);
          const col = await fetch("/api/collections");
          if (col.ok) {
            const { items: ci } = (await col.json()) as { items: { item_key: string }[] };
            setSavedKeys(new Set(ci.map((r) => r.item_key)));
          }
        } catch { /* User-Daten optional - statische Daten reichen */ }
        const all = [...extra, ...db.items];
        setItems(all);
        setRates(db.rates);
        setLoaded(true);
        // Deep-Link ?item=<key> oeffnet das Item direkt
        const want = new URLSearchParams(window.location.search).get("item");
        if (want) {
          const hit = all.find((it) => itemKey(it) === want);
          if (hit) setModal(hit);
        }
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  const view = useMemo(() => {
    const toks = fold(qLive.trim()).split(/\s+/).filter(Boolean);
    const lo = parseFloat(pmin), hi = parseFloat(pmax);
    const hasLo = !isNaN(lo), hasHi = !isNaN(hi);
    let v = items.filter((it) => {
      if (cat === VERIFIED) { if (!it.verified) return false; }
      else if (cat && it.c !== cat) return false;
      if (toks.length) {
        const hay = it._h || "";
        for (const tk of toks) if (!hay.includes(tk)) return false;
      }
      if (hasLo || hasHi) {
        const p = curOf(it, rates, cur);
        if (isNaN(p)) return false;
        if (hasLo && p < lo) return false;
        if (hasHi && p > hi) return false;
      }
      return true;
    });
    if (sort === "name") v = [...v].sort((a, b) => a.n.localeCompare(b.n, lang));
    else if (sort === "pa" || sort === "pd") {
      const dir = sort === "pa" ? 1 : -1;
      v = [...v].sort((a, b) => {
        const x = eurOf(a, rates), y = eurOf(b, rates);
        if (isNaN(x) && isNaN(y)) return 0;
        if (isNaN(x)) return 1;
        if (isNaN(y)) return -1;
        return (x - y) * dir;
      });
    } else if (sort === "shuffle") v = shuffled(v);
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, qLive, cat, sort, rates, pmin, pmax, cur, lang, shuffleSeed]);

  useEffect(() => { setShown(BATCH); }, [qLive, cat, sort, pmin, pmax, shuffleSeed]);

  const onSearch = useCallback((val: string) => {
    setQ(val);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setQLive(val), 90);
  }, []);

  const priceLabel = useCallback((it: Item): string => {
    const v = curOf(it, rates, cur);
    return isNaN(v) ? it.p || "" : fmtCur(v, cur);
  }, [rates, cur]);

  const cnyLabel = useCallback((it: Item): string => {
    const eur = eurOf(it, rates);
    return isNaN(eur) ? "" : fmtCNY(eur * rates.CNY);
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

  function openModal(it: Item | null) {
    setModal(it);
    const url = new URL(window.location.href);
    if (it) url.searchParams.set("item", itemKey(it));
    else url.searchParams.delete("item");
    window.history.replaceState(null, "", url.toString());
  }

  const cats = useMemo(() => {
    const present = new Set(items.map((i) => i.c));
    const hasVerified = items.some((i) => i.verified);
    return CAT_ORDER.filter((c) => (c === VERIFIED ? hasVerified : present.has(c)));
  }, [items]);

  const locale = lang === "en" ? "en-GB" : "de-AT";
  return (
    <>
      <header className="site">
        <div className="head-inner">
          <div className="head-top">
            <h1 className="logo"><a href="/">Kina<span className="tick">/</span>Search</a></h1>
            <div className="manifest">
              <b>{view.length.toLocaleString(locale)}</b> {tr("hits")} · {items.length.toLocaleString(locale)} {tr("items")}
            </div>
            <UserBar />
          </div>
          <div className="searchrow">
            <input id="q" type="search" placeholder={tr("search_ph")}
              autoComplete="off" value={q} onChange={(e) => onSearch(e.target.value)} />
            <input className="pricefld" inputMode="decimal" placeholder={cur === "EUR" ? tr("price_min") : "$ min"}
              value={pmin} onChange={(e) => setPmin(e.target.value)} aria-label="Preis min" />
            <input className="pricefld" inputMode="decimal" placeholder={cur === "EUR" ? tr("price_max") : "$ max"}
              value={pmax} onChange={(e) => setPmax(e.target.value)} aria-label="Preis max" />
            <select value={cur} onChange={(e) => setPrefs({ cur: e.target.value as Cur })} aria-label="Currency">
              <option value="EUR">€ EUR</option>
              <option value="USD">$ USD</option>
            </select>
            <select value={lang} onChange={(e) => setPrefs({ lang: e.target.value as Lang })} aria-label="Language">
              <option value="de">DE</option>
              <option value="en">EN</option>
            </select>
            <button className="iconbtn" type="button" aria-label="Theme"
              onClick={() => setPrefs({ theme: theme === "dark" ? "light" : "dark" })}>
              {theme === "dark" ? "☀" : "☾"}
            </button>
            <select value={sort === "shuffle" ? "rel" : sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              <option value="rel">{tr("sort_rel")}</option>
              <option value="pa">{tr("sort_pa")}</option>
              <option value="pd">{tr("sort_pd")}</option>
              <option value="name">{tr("sort_name")}</option>
            </select>
            <button className="iconbtn wide" type="button"
              onClick={() => { setSort("shuffle"); setShuffleSeed((s) => s + 1); }}>
              ⚄ {tr("discover")}
            </button>
          </div>
          <div className="chips" role="tablist" aria-label="Kategorie">
            <button className={`chip${cat === "" ? " on" : ""}`} onClick={() => setCat("")}>{catLabel("Alle")}</button>
            {cats.map((c) => (
              <button key={c}
                className={`chip${c === VERIFIED ? " vchip" : ""}${cat === c ? " on" : ""}`}
                onClick={() => setCat(cat === c ? "" : c)}>{catLabel(c)}</button>
            ))}
          </div>
        </div>
      </header>

      <main className="wrap">
        {!loaded && !error && <div className="loading">{tr("loading")}</div>}
        {error && <div className="notice err">Error: {error}</div>}
        {loaded && view.length === 0 && (
          <div className="empty">
            <div className="big">{tr("empty_title")}</div>
            {tr("empty_sub")}
          </div>
        )}
        {loaded && view.length > 0 && (
          <div id="grid">
            {view.slice(0, shown).map((it, i) => (
              <Card key={itemKey(it) + i} it={it} price={priceLabel(it)} cny={cnyLabel(it)}
                saved={savedKeys.has(itemKey(it))}
                onOpen={() => openModal(it)} onSave={() => toggleSave(it)} />
            ))}
          </div>
        )}
        {loaded && shown < view.length && (
          <button className="morebtn" onClick={() => setShown((s) => s + BATCH)}>{tr("load_more")}</button>
        )}
      </main>

      <footer className="site">{tr("footer")}</footer>

      {needsOnboarding && <Onboarding onDone={finishOnboarding} />}

      {modal && <Modal it={modal} rates={rates} cur={cur} lang={lang} agentKey={prefs.agent}
        saved={savedKeys.has(itemKey(modal))}
        onSave={() => toggleSave(modal)} onClose={() => openModal(null)} />}
    </>
  );
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const { prefs, setPrefs } = usePrefs();
  const [lang, setLang] = useState<Lang>(prefs.lang);
  const [cur, setCur] = useState<Cur>(prefs.cur);
  const [theme, setTheme] = useState<Theme>(prefs.theme);
  const [agent, setAgent] = useState(prefs.agent);
  const tr = (k: TKey) => t(lang, k);

  function done() {
    setPrefs({ lang, cur, theme, agent });
    onDone();
  }

  const seg = (on: boolean) => `segbtn${on ? " on" : ""}`;
  return (
    <div className="modal-back">
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-info">
          <div className="modal-name">{tr("ob_title")}</div>
          <p className="sub" style={{ marginBottom: 18 }}>{tr("ob_sub")}</p>

          <div className="ob-row">
            <span className="ob-label">{tr("ob_lang")}</span>
            <div className="seg">
              <button className={seg(lang === "de")} onClick={() => setLang("de")}>Deutsch</button>
              <button className={seg(lang === "en")} onClick={() => setLang("en")}>English</button>
            </div>
          </div>
          <div className="ob-row">
            <span className="ob-label">{tr("ob_cur")}</span>
            <div className="seg">
              <button className={seg(cur === "EUR")} onClick={() => setCur("EUR")}>€ EUR</button>
              <button className={seg(cur === "USD")} onClick={() => setCur("USD")}>$ USD</button>
            </div>
          </div>
          <div className="ob-row">
            <span className="ob-label">{tr("ob_theme")}</span>
            <div className="seg">
              <button className={seg(theme === "light")} onClick={() => setTheme("light")}>☀ {tr("ob_light")}</button>
              <button className={seg(theme === "dark")} onClick={() => setTheme("dark")}>☾ {tr("ob_dark")}</button>
            </div>
          </div>
          <div className="ob-row" style={{ alignItems: "flex-start" }}>
            <span className="ob-label" style={{ paddingTop: 8 }}>{tr("ob_agent")}</span>
            <div style={{ flex: 1 }}>
              <p className="sub" style={{ marginBottom: 8, fontSize: 12 }}>{tr("ob_agent_sub")}</p>
              <div className="agentgrid">
                {AGENTS.map((a) => {
                  const key = a.n.toLowerCase();
                  return (
                    <button key={a.n} className={seg(agent === key)} onClick={() => setAgent(key)}>
                      {a.fav ? `★ ${a.n}` : a.n}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <button className="btn" style={{ marginTop: 18 }} onClick={done}>{tr("ob_done")}</button>
        </div>
      </div>
    </div>
  );
}

function Card({ it, price, cny, saved, onOpen, onSave }: {
  it: Item; price: string; cny: string; saved: boolean; onOpen: () => void; onSave: () => void;
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
          <span className="src">{cny}</span>
        </div>
      </div>
    </a>
  );
}

function Modal({ it, rates, cur, lang, agentKey, saved, onSave, onClose }: {
  it: Item; rates: Rates; cur: Cur; lang: Lang; agentKey: string; saved: boolean;
  onSave: () => void; onClose: () => void;
}) {
  const tr = (k: TKey) => t(lang, k);
  const [copied, setCopied] = useState(false);
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
  const val = curOf(it, rates, cur);
  const raw = rawUrl(it);
  const favAgent = agentByKey(agentKey);
  const favHref = agentLink(favAgent, it);
  const platLabel = it.pf === "wd" ? "Original (Weidian)" : it.pf === "tb" ? "Original (Taobao)"
    : it.pf === "al" ? "Original (1688)" : tr("original");

  function share() {
    const url = new URL(window.location.origin);
    url.searchParams.set("item", itemKey(it));
    navigator.clipboard?.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

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
            <div className="modal-brand">{it.b || (it.verified ? tr("verified") : "")}</div>
            <div className="modal-name">{it.n}</div>
            <div className="modal-price">
              {!isNaN(eur) ? (
                <>
                  <span className="eur">{fmtCur(val, cur)}</span>
                  <span className="cny">{fmtCNY(eur * rates.CNY)}</span>
                </>
              ) : it.p ? (
                <span className="eur" style={{ fontSize: 18 }}>{it.p}</span>
              ) : (
                <span className="cny">{tr("no_price")}</span>
              )}
            </div>
            <div className="modal-meta">{it.c}</div>
            {it.verified && (
              <div className="vnote">
                <div className="vr">★ {it.verified.rating.toFixed(1)} / 10 – {tr("verified")}</div>
                {it.verified.note && <p>{it.verified.note}</p>}
              </div>
            )}
            {favHref && (
              <a className="orig-btn" style={{ marginBottom: 8 }} href={favHref}
                target="_blank" rel="noopener noreferrer">
                {tr("open_at")} {favAgent.n} →
              </a>
            )}
            <div style={{ display: "flex", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <button className="smallbtn" onClick={onSave}>
                {saved ? `✓ ${tr("saved")}` : `+ ${tr("save")}`}
              </button>
              <button className="smallbtn" onClick={share}>
                {copied ? `✓ ${tr("copied")}` : tr("copy_link")}
              </button>
              {raw && (
                <a className="smallbtn" href={raw} target="_blank" rel="noopener noreferrer">{platLabel}</a>
              )}
            </div>
            <div className="mod-sec">{tr("other_agents")}</div>
            <div className="linkgrid">
              {AGENTS.map((ag) => {
                if (ag.n === favAgent.n) return null;
                const href = agentLink(ag, it);
                if (!href) return null;
                return (
                  <a key={ag.n} href={href} target="_blank" rel="noopener noreferrer">{ag.n}</a>
                );
              })}
            </div>
            {raw && (
              <>
                <div className="mod-sec">{tr("qc_photos")}</div>
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
