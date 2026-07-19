"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePrefs } from "@/components/Prefs";

const CATS = ["Schuhe", "Shirts & Tees", "Hoodies & Sweater", "Jacken", "Hosen & Shorts",
  "Trikots", "Taschen", "Uhren", "Schmuck & Accessoires", "Parfum", "Elektronik", "Sonstiges"];

type Sub = { id: string; name: string; url: string; status: string; created_at: string };

export default function Submit() {
  const { status } = useSession();
  const { prefs } = usePrefs();
  const en = prefs.lang === "en";
  const [mine, setMine] = useState<Sub[]>([]);
  const [form, setForm] = useState({ name: "", url: "", price: "", category: "Schuhe", image_url: "", note: "" });
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/submissions?scope=mine").then(async (r) => {
        if (r.ok) setMine(await r.json());
      });
    }
  }, [status]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.status === 401) { window.location.href = "/login"; return; }
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setState("err"); setMsg(d.error || "Fehler beim Einreichen.");
      return;
    }
    setState("ok");
    setMsg(en ? "Submitted. The item appears once approved." : "Eingereicht. Das Item erscheint, sobald es freigegeben wurde.");
    setMine((p) => [{ id: crypto.randomUUID(), name: form.name, url: form.url, status: "pending", created_at: new Date().toISOString() }, ...p]);
    setForm({ name: "", url: "", price: "", category: form.category, image_url: "", note: "" });
  }

  if (status === "loading") return <main className="page"><div className="loading">…</div></main>;
  if (status === "unauthenticated") {
    return (
      <main className="page">
        <h2>{en ? "Submit an item" : "Item einreichen"}</h2>
        <div className="notice">
          {en ? <>You need to <a href="/login">sign in</a> to submit items.</>
              : <>Zum Einreichen musst du <a href="/login">angemeldet</a> sein.</>}
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <h2>{en ? "Submit an item" : "Item einreichen"}</h2>
      <p className="sub">
        {en ? "A Weidian, Taobao, 1688 or agent link plus a name is enough. Every submission is reviewed before it goes live."
            : "Weidian-, Taobao-, 1688- oder Agent-Link plus Name reichen. Jede Einreichung wird vor Veröffentlichung geprüft."}
      </p>
      {state === "ok" && <div className="notice ok">{msg}</div>}
      {state === "err" && <div className="notice err">{msg}</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="name">{en ? "Item name" : "Item-Name"}</label>
          <input id="name" required minLength={3} maxLength={160} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="z.B. Nike Tech Fleece Tracksuit (grau)" />
        </div>
        <div className="field">
          <label htmlFor="url">{en ? "Product link" : "Produkt-Link"}</label>
          <input id="url" type="url" required value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://weidian.com/item.html?itemID=…" />
        </div>
        <div className="field">
          <label htmlFor="price">{en ? "Price (optional, e.g. ¥180 or $25)" : "Preis (optional, z.B. ¥180 oder $25)"}</label>
          <input id="price" maxLength={60} value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="cat">{en ? "Category" : "Kategorie"}</label>
          <select id="cat" value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="img">{en ? "Image URL (optional)" : "Bild-URL (optional)"}</label>
          <input id="img" type="url" value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="note">{en ? "Note to moderation (optional)" : "Notiz an die Moderation (optional)"}</label>
          <textarea id="note" rows={3} maxLength={500} value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
        <button className="btn" type="submit">{en ? "Submit" : "Einreichen"}</button>
      </form>

      {mine.length > 0 && (
        <>
          <h2 style={{ marginTop: 34, fontSize: 20 }}>{en ? "Your submissions" : "Deine Einreichungen"}</h2>
          {mine.map((s) => (
            <div className="rowcard" key={s.id}>
              <div className="grow">
                <div className="nm">{s.name}</div>
                <div className="mt">{s.url}</div>
              </div>
              <span className="mt">
                {s.status === "pending" ? (en ? "Awaiting review" : "Wartet auf Freigabe")
                  : s.status === "approved" ? (en ? "Approved" : "Freigegeben") : (en ? "Rejected" : "Abgelehnt")}
              </span>
            </div>
          ))}
        </>
      )}
      <p className="sub" style={{ marginTop: 22 }}>
        <a href="/">{en ? "Back to search" : "Zurück zur Suche"}</a>
      </p>
    </main>
  );
}
