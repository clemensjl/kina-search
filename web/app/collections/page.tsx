"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Col = { id: string; name: string };
type Ci = { collection_id: string; item_key: string; item_name: string | null; item_image: string | null; item_price: string | null };

export default function Collections() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [cols, setCols] = useState<Col[]>([]);
  const [items, setItems] = useState<Ci[]>([]);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getUser().then(async ({ data }) => {
      setAuthed(!!data.user);
      if (data.user) refresh();
    });
  }, []);

  async function refresh() {
    const sb = supabaseBrowser();
    const [{ data: c }, { data: ci }] = await Promise.all([
      sb.from("collections").select("id,name").order("created_at"),
      sb.from("collection_items").select("*").order("added_at", { ascending: false }),
    ]);
    setCols((c as Col[]) || []);
    setItems((ci as Ci[]) || []);
  }

  async function addCol(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabaseBrowser();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user || !newName.trim()) return;
    await sb.from("collections").insert({ user_id: auth.user.id, name: newName.trim() });
    setNewName("");
    refresh();
  }

  async function removeItem(colId: string, key: string) {
    await supabaseBrowser().from("collection_items").delete()
      .eq("collection_id", colId).eq("item_key", key);
    setItems((p) => p.filter((i) => !(i.collection_id === colId && i.item_key === key)));
  }

  async function removeCol(id: string) {
    await supabaseBrowser().from("collections").delete().eq("id", id);
    refresh();
  }

  if (authed === null) return <main className="page"><div className="loading">Lade …</div></main>;
  if (!authed) {
    return (
      <main className="page">
        <h2>Collections</h2>
        <div className="notice">Zum Speichern von Items musst du <a href="/login">angemeldet</a> sein.</div>
      </main>
    );
  }

  return (
    <main className="page" style={{ maxWidth: 860 }}>
      <h2>Collections</h2>
      <p className="sub">Deine gespeicherten Items, sortiert nach Liste.</p>
      <form onSubmit={addCol} style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        <input style={{ flex: 1 }} className="sel" placeholder="Neue Collection …" value={newName}
          maxLength={60} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn ghost" type="submit">Anlegen</button>
      </form>
      {cols.map((c) => {
        const ci = items.filter((i) => i.collection_id === c.id);
        return (
          <section key={c.id} style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
              <h2 style={{ fontSize: 20 }}>{c.name}</h2>
              <span className="mt" style={{ color: "var(--muted)", fontSize: 12 }}>{ci.length} Items</span>
              <button className="smallbtn" style={{ marginLeft: "auto" }} onClick={() => removeCol(c.id)}>
                Collection löschen
              </button>
            </div>
            {ci.length === 0 && <div className="notice">Noch leer – speichere Items über das + auf einer Produktkarte.</div>}
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
                  <a className="smallbtn primary" href={`/?q=${encodeURIComponent(i.item_name || "")}`}>Suchen</a>
                  <button className="smallbtn" onClick={() => removeItem(c.id, i.item_key)}>Entfernen</button>
                </div>
              </div>
            ))}
          </section>
        );
      })}
      <p className="sub" style={{ marginTop: 22 }}><a href="/">Zurück zur Suche</a></p>
    </main>
  );
}
