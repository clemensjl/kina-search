"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { isAdminEmail } from "@/components/UserBar";

type Sub = {
  id: string; name: string; url: string; price: string | null; category: string;
  image_url: string | null; note: string | null; user_email: string; created_at: string;
};
type Ver = { id: string; name: string; url: string; rating: number; category: string | null };

const CATS = ["Schuhe", "Shirts & Tees", "Hoodies & Sweater", "Jacken", "Hosen & Shorts",
  "Trikots", "Taschen", "Uhren", "Schmuck & Accessoires", "Parfum", "Elektronik", "Sonstiges"];

export default function Admin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [pending, setPending] = useState<Sub[]>([]);
  const [verified, setVerified] = useState<Ver[]>([]);
  const [vform, setVform] = useState({ name: "", url: "", price: "", category: "Schuhe", image_url: "", rating: "8.0", note: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getUser().then(async ({ data }) => {
      const ok = isAdminEmail(data.user?.email);
      setAllowed(ok);
      if (ok) refresh();
    });
  }, []);

  async function refresh() {
    const sb = supabaseBrowser();
    const [{ data: subs }, { data: ver }] = await Promise.all([
      sb.from("submissions").select("*").eq("status", "pending").order("created_at"),
      sb.from("verified_items").select("id,name,url,rating,category").order("created_at", { ascending: false }),
    ]);
    setPending((subs as Sub[]) || []);
    setVerified((ver as Ver[]) || []);
  }

  async function decide(id: string, status: "approved" | "rejected") {
    const sb = supabaseBrowser();
    const { error } = await sb.from("submissions")
      .update({ status, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) { setMsg(error.message); return; }
    setPending((p) => p.filter((s) => s.id !== id));
  }

  async function addVerified(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabaseBrowser();
    const { error } = await sb.from("verified_items").insert({
      name: vform.name.trim(), url: vform.url.trim(),
      price: vform.price.trim() || null, category: vform.category,
      image_url: vform.image_url.trim() || null,
      rating: parseFloat(vform.rating), note: vform.note.trim() || null,
    });
    if (error) { setMsg(error.message); return; }
    setMsg("Verifiziertes Item angelegt.");
    setVform({ name: "", url: "", price: "", category: vform.category, image_url: "", rating: "8.0", note: "" });
    refresh();
  }

  async function removeVerified(id: string) {
    await supabaseBrowser().from("verified_items").delete().eq("id", id);
    setVerified((p) => p.filter((v) => v.id !== id));
  }

  if (allowed === null) return <main className="page"><div className="loading">Lade …</div></main>;
  if (!allowed) {
    return (
      <main className="page">
        <h2>Admin</h2>
        <div className="notice err">Kein Zugriff. Dieser Bereich ist dem Betreiber vorbehalten.</div>
      </main>
    );
  }

  return (
    <main className="page" style={{ maxWidth: 860 }}>
      <h2>Moderation</h2>
      <p className="sub">{pending.length} Einreichung(en) warten auf Freigabe.</p>
      {msg && <div className="notice">{msg}</div>}
      {pending.map((s) => (
        <div className="rowcard" key={s.id}>
          {s.image_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={s.image_url} alt="" referrerPolicy="no-referrer" />
          )}
          <div className="grow">
            <div className="nm">{s.name}</div>
            <div className="mt">{s.category} · {s.price || "kein Preis"} · von {s.user_email}</div>
            <div className="mt"><a href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a></div>
            {s.note && <div className="mt">Notiz: {s.note}</div>}
          </div>
          <div className="actions">
            <button className="smallbtn primary" onClick={() => decide(s.id, "approved")}>Freigeben</button>
            <button className="smallbtn" onClick={() => decide(s.id, "rejected")}>Ablehnen</button>
          </div>
        </div>
      ))}
      {pending.length === 0 && <div className="notice ok">Queue leer.</div>}

      <h2 style={{ marginTop: 36 }}>Von uns verifiziert</h2>
      <p className="sub">Nur hier angelegte Items tragen Badge und Rating.</p>
      <form onSubmit={addVerified}>
        <div className="field"><label>Name</label>
          <input required minLength={3} maxLength={160} value={vform.name}
            onChange={(e) => setVform({ ...vform, name: e.target.value })} /></div>
        <div className="field"><label>Produkt-Link</label>
          <input type="url" required value={vform.url}
            onChange={(e) => setVform({ ...vform, url: e.target.value })} /></div>
        <div className="field"><label>Rating (0-10)</label>
          <input type="number" min="0" max="10" step="0.1" required value={vform.rating}
            onChange={(e) => setVform({ ...vform, rating: e.target.value })} /></div>
        <div className="field"><label>Preis (optional)</label>
          <input maxLength={60} value={vform.price}
            onChange={(e) => setVform({ ...vform, price: e.target.value })} /></div>
        <div className="field"><label>Kategorie</label>
          <select value={vform.category} onChange={(e) => setVform({ ...vform, category: e.target.value })}>
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select></div>
        <div className="field"><label>Bild-URL (optional)</label>
          <input type="url" value={vform.image_url}
            onChange={(e) => setVform({ ...vform, image_url: e.target.value })} /></div>
        <div className="field"><label>Test-Notiz (optional)</label>
          <textarea rows={3} maxLength={1000} value={vform.note}
            onChange={(e) => setVform({ ...vform, note: e.target.value })} /></div>
        <button className="btn" type="submit">Verifiziertes Item anlegen</button>
      </form>

      {verified.length > 0 && (
        <>
          <h2 style={{ marginTop: 30, fontSize: 20 }}>Bestehende ({verified.length})</h2>
          {verified.map((v) => (
            <div className="rowcard" key={v.id}>
              <div className="grow">
                <div className="nm">★ {Number(v.rating).toFixed(1)} – {v.name}</div>
                <div className="mt">{v.category} · {v.url}</div>
              </div>
              <button className="smallbtn" onClick={() => removeVerified(v.id)}>Entfernen</button>
            </div>
          ))}
        </>
      )}
      <p className="sub" style={{ marginTop: 22 }}><a href="/">Zurück zur Suche</a></p>
    </main>
  );
}
