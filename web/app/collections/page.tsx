"use client";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePrefs } from "@/components/Prefs";

type Col = { id: string; name: string };
type Ci = { collection_id: string; item_key: string; item_name: string | null; item_image: string | null; item_price: string | null };

export default function Collections() {
  const { status } = useSession();
  const { prefs } = usePrefs();
  const en = prefs.lang === "en";
  const [cols, setCols] = useState<Col[]>([]);
  const [items, setItems] = useState<Ci[]>([]);
  const [newName, setNewName] = useState("");

  const refresh = useCallback(async () => {
    const r = await fetch("/api/collections");
    if (!r.ok) return;
    const d = await r.json();
    setCols(d.collections);
    setItems(d.items);
  }, []);

  useEffect(() => { if (status === "authenticated") refresh(); }, [status, refresh]);

  async function addCol(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await fetch("/api/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setNewName("");
    refresh();
  }

  async function removeItem(colId: string, key: string) {
    await fetch("/api/collections/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ item_key: key }),
    });
    setItems((p) => p.filter((i) => !(i.collection_id === colId && i.item_key === key)));
  }

  async function removeCol(id: string) {
    await fetch(`/api/collections?id=${id}`, { method: "DELETE" });
    refresh();
  }

  if (status === "loading") return <main className="page"><div className="loading">…</div></main>;
  if (status === "unauthenticated") {
    return (
      <main className="page">
        <h2>Collections</h2>
        <div className="notice">
          {en ? <>You need to <a href="/login">sign in</a> to save items.</>
              : <>Zum Speichern von Items musst du <a href="/login">angemeldet</a> sein.</>}
        </div>
      </main>
    );
  }

  return (
    <main className="page" style={{ maxWidth: 860 }}>
      <h2>Collections</h2>
      <p className="sub">{en ? "Your saved items, grouped by list." : "Deine gespeicherten Items, sortiert nach Liste."}</p>
      <form onSubmit={addCol} style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        <input style={{ flex: 1, fontFamily: "var(--font-body)", fontSize: 15, padding: "10px 12px", border: "1.5px solid var(--line-strong)", borderRadius: 6 }}
          placeholder={en ? "New collection …" : "Neue Collection …"} value={newName}
          maxLength={60} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn ghost" type="submit">{en ? "Create" : "Anlegen"}</button>
      </form>
      {cols.map((c) => {
        const ci = items.filter((i) => i.collection_id === c.id);
        return (
          <section key={c.id} style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
              <h2 style={{ fontSize: 20 }}>{c.name}</h2>
              <span style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>{ci.length} Items</span>
              <button className="smallbtn" style={{ marginLeft: "auto" }} onClick={() => removeCol(c.id)}>
                {en ? "Delete collection" : "Collection löschen"}
              </button>
            </div>
            {ci.length === 0 && (
              <div className="notice">
                {en ? "Empty – save items via the + on any product card." : "Noch leer – speichere Items über das + auf einer Produktkarte."}
              </div>
            )}
            {ci.map((i) => (
              <div className="rowcard" key={i.item_key}>
                {i.item_image && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={i.item_image} alt="" referrerPolicy="no-referrer" />
                )}
                <div className="grow">
                  <div className="nm">{i.item_name || i.item_key}</div>
                  <div className="mt">{i.item_price || ""}</div>
                </div>
                <div className="actions">
                  <a className="smallbtn primary" href={`/?item=${encodeURIComponent(i.item_key)}`}>{en ? "Open" : "Öffnen"}</a>
                  <button className="smallbtn" onClick={() => removeItem(c.id, i.item_key)}>{en ? "Remove" : "Entfernen"}</button>
                </div>
              </div>
            ))}
          </section>
        );
      })}
      <p className="sub" style={{ marginTop: 22 }}>
        <a href="/">{en ? "Back to search" : "Zurück zur Suche"}</a>
      </p>
    </main>
  );
}
