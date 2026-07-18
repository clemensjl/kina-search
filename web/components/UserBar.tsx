"use client";
import { signOut, useSession } from "next-auth/react";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null) {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export default function UserBar() {
  const { data: session, status } = useSession();
  if (status === "loading") return <nav className="userbar" />;
  const email = session?.user?.email;
  return (
    <nav className="userbar">
      {email ? (
        <>
          <a href="/submit">Einreichen</a>
          <a href="/collections">Collections</a>
          {isAdminEmail(email) && <a href="/admin">Admin</a>}
          <span className="you" title={email}>{email.split("@")[0]}</span>
          <a href="#" onClick={(e) => { e.preventDefault(); signOut({ callbackUrl: "/" }); }}>Abmelden</a>
        </>
      ) : (
        <a href="/login">Anmelden</a>
      )}
    </nav>
  );
}
