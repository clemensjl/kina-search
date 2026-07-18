// Laedt die statische Produktdatenbank (GitHub Pages als Daten-/Bild-CDN)
// und decodiert das Kompakt-Format aus compact.py.
import type { Item } from "./agents";

export const DATA_BASE =
  process.env.NEXT_PUBLIC_DATA_URL || "https://clemensjl.github.io/kina-search";

export type Rates = Record<string, number>;
export type Db = { items: Item[]; rates: Rates; cats: string[] };
export type Cur = "EUR" | "USD";

const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export async function loadDb(): Promise<Db> {
  const r = await fetch(`${DATA_BASE}/items.json`);
  if (!r.ok) throw new Error(`items.json HTTP ${r.status}`);
  const d = await r.json();
  const items: Item[] = Array.isArray(d) ? d : d.items;
  const meta = d.meta || {};
  const rates: Rates = meta.rates || { CNY: 7.8, USD: 1.08, GBP: 0.85, EUR: 1 };
  if (meta.cats) {
    type RawItem = Omit<Item, "s" | "c"> & { s?: number | string; c: number | string };
    for (const it of items as unknown as RawItem[]) {
      delete it.s;
      if (typeof it.c === "number") it.c = meta.cats[it.c] ?? String(it.c);
      if (it.i && /^\d:/.test(it.i)) {
        const k = it.i.indexOf(":");
        it.i = meta.iprefix[+it.i.slice(0, k)] + it.i.slice(k + 1);
      }
      if (it.i && !it.i.startsWith("http")) it.i = `${DATA_BASE}/${it.i}`;
    }
  }
  for (const it of items) it._h = fold(`${it.n} ${it.b || ""} ${it.c}`);
  return { items, rates, cats: meta.cats || [] };
}

export function eurOf(it: Item, rates: Rates): number {
  if (it.pv == null || !it.pc || !rates[it.pc]) return NaN;
  return it.pv / rates[it.pc];
}
/** Preis in der Nutzerwaehrung (EUR-Basis * Kurs). */
export function curOf(it: Item, rates: Rates, cur: Cur): number {
  const eur = eurOf(it, rates);
  return cur === "EUR" ? eur : eur * (rates.USD || 1.08);
}
export const fmtCur = (v: number, cur: Cur) =>
  (cur === "EUR" ? "€ " : "$ ") +
  v.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtCNY = (v: number) =>
  "¥ " + v.toLocaleString("de-AT", { maximumFractionDigits: 0 });
export { fold };
