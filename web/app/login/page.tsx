"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

const MAGIC_ENABLED = process.env.NEXT_PUBLIC_MAGIC_LINK === "1";

export default function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "err">("idle");
  const [msg, setMsg] = useState("");

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    const res = await signIn("resend", { email, redirect: false, callbackUrl: "/" });
    if (res?.error) { setState("err"); setMsg("Versand fehlgeschlagen - versuche Google-Login."); }
    else setState("sent");
  }

  return (
    <main className="page">
      <h2>Anmelden</h2>
      <p className="sub">
        Nur angemeldete Accounts können Items einreichen und Collections anlegen.
      </p>
      <button className="btn" onClick={() => signIn("google", { callbackUrl: "/" })}>
        Mit Google anmelden
      </button>
      {MAGIC_ENABLED ? (
        <>
          <div style={{ margin: "18px 0", color: "var(--muted)", fontSize: 13 }}>oder</div>
          {state === "sent" && (
            <div className="notice ok">Link verschickt. Öffne die E-Mail an {email} und klicke den Anmelde-Link.</div>
          )}
          {state === "err" && <div className="notice err">{msg}</div>}
          <form onSubmit={magicLink}>
            <div className="field">
              <label htmlFor="email">E-Mail-Adresse</label>
              <input id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="du@example.com" />
            </div>
            <button className="btn ghost" type="submit">Einmaligen Anmelde-Link senden</button>
          </form>
        </>
      ) : (
        <p className="sub" style={{ marginTop: 16 }}>
          Anmeldung per E-Mail-Link folgt in Kürze.
        </p>
      )}
      <p className="sub" style={{ marginTop: 22 }}><a href="/">Zurück zur Suche</a></p>
    </main>
  );
}
