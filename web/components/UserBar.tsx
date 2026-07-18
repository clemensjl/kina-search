"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null) {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export default function UserBar() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabaseBrowser().auth.signOut();
    window.location.href = "/";
  }

  if (!ready) return <nav className="userbar" />;
  return (
    <nav className="userbar">
      {email ? (
        <>
          <a href="/submit">Einreichen</a>
          <a href="/collections">Collections</a>
          {isAdminEmail(email) && <a href="/admin">Admin</a>}
          <span className="you" title={email}>{email.split("@")[0]}</span>
          <a href="#" onClick={(e) => { e.preventDefault(); logout(); }}>Abmelden</a>
        </>
      ) : (
        <a href="/login">Anmelden</a>
      )}
    </nav>
  );
}
