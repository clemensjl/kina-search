import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

const providers = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}
// Magic-Link aktiviert sich, sobald eine Resend-Domain verifiziert und
// AUTH_RESEND_KEY + EMAIL_FROM gesetzt sind.
if (process.env.AUTH_RESEND_KEY && process.env.EMAIL_FROM) {
  providers.push(Resend({ from: process.env.EMAIL_FROM }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
});

export function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
