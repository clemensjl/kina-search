"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const CATS = ["Schuhe", "Shirts & Tees", "Hoodies & Sweater", "Jacken", "Hosen & Shorts",
  "Trikots", "Taschen", "Uhren", "Schmuck & Accessoires", "Parfum", "Elektronik", "Sonstiges"];

type Sub = { id: string; name: string; url: string; status: string; created_at: string };

export default function Submit() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [mine, setMine] = useState<Sub[]>([]);
  const [form, setForm] = useState({ name: "", url: "", price: "", category: "Schuhe", image_url: "", note: "" });
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getUser().then(async ({ data }) => {
      setAuthed(!!data.user);
      if (data.user) {
        const { data: subs } = await sb.from("submissions")
          .select("id,name,url,status,created_at")
          .eq("user_id", data.user.id).order("created_at", { ascending: false }).limit(30);
        setMine(subs || []);
      }
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabaseBrowser();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) { window.location.href = "/login"; return; }
    const { error } = await sb.from("submissions").insert({
      user_id: auth.user.id,
      user_email: auth.user.email,
      name: form.name.trim(),
      url: form.url.trim(),
      price: form.price.trim() || null,
      category: form.category,
      image_url: form.image_url.trim() || null,
      note: form.note.trim() || null,
    });
    if (error) { setState("err"); setMsg(error.message); return; }
    setState("ok");
    setMsg("Eingereicht. Das Item erscheint, sobald es freigegeben wurde.");
    setMine((p) => [{ id: crypto.randomUUID(), name: form.name, url: form.url, status: "pending", created_at: new Date().toISOString() }, ...p]);
    setForm({ name: "", url: "", price: "", category: form.category, image_url: "", note: "" });
  }

  if (authed === null) return <main className="page"><div className="loading">Lade …</div></main>;
  if (!authed) {
    return (
      <main className="page">
        <h2>Item einreichen</h2>
        <div className="notice">Zum Einreichen musst du <a href="/login">angemeldet</a> sein.</div>
      </main>
    );
  }

  return (
    <main className="page">
      <h2>Item einreichen</h2>
      <p className="sub">
        Weidian-, Taobao-, 1688- oder Agent-Link plus Name reichen. Jede Einreichung
        wird vor Veröffentlichung geprüft.
      </p>
      {state === "ok" && <div className="notice ok">{msg}</div>}
      {state === "err" && <div className="notice err">{msg}</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="name">Item-Name</label>
          <input id="name" required minLength={3} maxLength={160} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="z.B. Nike Tech Fleece Tracksuit (grau)" />
        </div>
        <div className="field">
          <label htmlFor="url">Produkt-Link</label>
          <input id="url" type="url" required value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://weidian.com/item.html?itemID=…" />
        </div>
        <div className="field">
          <label htmlFor="price">Preis (optional, z.B. ¥180 oder $25)</label>
          <input id="price" maxLength={60} value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="cat">Kategorie</label>
          <select id="cat" value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="img">Bild-URL (optional)</label>
          <input id="img" type="url" value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="note">Notiz an die Moderation (optional)</label>
          <textarea id="note" rows={3} maxLength={500} value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
        <button className="btn" type="submit">Einreichen</button>
      </form>

      {mine.length > 0 && (
        <>
          <h2 style={{ marginTop: 34, fontSize: 20 }}>Deine Einreichungen</h2>
          {mine.map((s) => (
            <div className="rowcard" key={s.id}>
              <div className="grow">
                <div className="nm">{s.name}</div>
                <div className="mt">{s.url}</div>
              </div>
              <span className="mt">
                {s.status === "pending" ? "Wartet auf Freigabe" : s.status === "approved" ? "Freigegeben" : "Abgelehnt"}
              </span>
            </div>
          ))}
        </>
      )}
      <p className="sub" style={{ marginTop: 22 }}><a href="/">Zurück zur Suche</a></p>
    </main>
  );
}
