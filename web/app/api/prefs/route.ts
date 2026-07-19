import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureSchema, sql } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "auth" }, { status: 401 });
  await ensureSchema();
  const rows = await sql()`select currency, language, theme, agent from user_prefs
    where user_email=${session.user.email}`;
  return NextResponse.json(rows[0] ?? { currency: null, language: null, theme: null, agent: null });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "auth" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const currency = b.currency === "USD" ? "USD" : "EUR";
  const language = b.language === "en" ? "en" : "de";
  const theme = b.theme === "dark" ? "dark" : "light";
  const agent = String(b.agent || "litbuy").slice(0, 30).replace(/[^a-z0-9]/g, "");
  await ensureSchema();
  await sql()`insert into user_prefs (user_email, currency, language, theme, agent)
    values (${session.user.email},${currency},${language},${theme},${agent})
    on conflict (user_email) do update set
      currency=${currency}, language=${language}, theme=${theme}, agent=${agent}, updated_at=now()`;
  return NextResponse.json({ ok: true });
}
