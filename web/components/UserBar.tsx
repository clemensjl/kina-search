"use client";
import { signOut, useSession } from "next-auth/react";
import { usePrefs } from "@/components/Prefs";
import { t } from "@/lib/i18n";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null) {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export default function UserBar() {
  const { data: session, status } = useSession();
  const { prefs } = usePrefs();
  const lang = prefs.lang;
  if (status === "loading") return <nav className="userbar" />;
  const email = session?.user?.email;
  return (
    <nav className="userbar">
      {email ? (
        <>
          <a href="/submit">{t(lang, "submit_nav")}</a>
          <a href="/collections">{t(lang, "collections_nav")}</a>
          {isAdminEmail(email) && <a href="/admin">{t(lang, "admin_nav")}</a>}
          <span className="you" title={email}>{email.split("@")[0]}</span>
          <a href="#" onClick={(e) => { e.preventDefault(); signOut({ callbackUrl: "/" }); }}>
            {t(lang, "logout")}
          </a>
        </>
      ) : (
        <a href="/login">{t(lang, "login")}</a>
      )}
    </nav>
  );
}
