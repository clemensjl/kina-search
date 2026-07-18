"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "err">("idle");
  const [msg, setMsg] = useState("");

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setState("err"); setMsg(error.message); }
    else { setState("sent"); }
  }

  async function google() {
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setState("err"); setMsg("Google-Login ist noch nicht freigeschaltet."); }
  }

  return (
    <main className="page">
      <h2>Anmelden</h2>
      <p className="sub">
        Mit E-Mail bekommst du einen einmaligen Anmelde-Link – kein Passwort nötig.
        Nur verifizierte Accounts können Items einreichen und Collections anlegen.
      </p>
      {state === "sent" && (
        <div className="notice ok">
          Link verschickt. Öffne die E-Mail an {email} und klicke den Anmelde-Link.
        </div>
      )}
      {state === "err" && <div className="notice err">{msg}</div>}
      <form onSubmit={magicLink}>
        <div className="field">
          <label htmlFor="email">E-Mail-Adresse</label>
          <input id="email" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="du@example.com" />
        </div>
        <button className="btn" type="submit">Anmelde-Link senden</button>
      </form>
      <div style={{ margin: "18px 0", color: "var(--muted)", fontSize: 13 }}>oder</div>
      <button className="btn ghost" onClick={google}>Mit Google anmelden</button>
      <p className="sub" style={{ marginTop: 22 }}>
        <a href="/">Zurück zur Suche</a>
      </p>
    </main>
  );
}
