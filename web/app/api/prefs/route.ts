import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureSchema, sql } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "auth" }, { status: 401 });
  await ensureSchema();
  const rows = await sql()`select currency from user_prefs where user_email=${session.user.email}`;
  return NextResponse.json({ currency: rows[0]?.currency ?? null });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { currency } = await request.json().catch(() => ({}));
  if (currency !== "EUR" && currency !== "USD") {
    return NextResponse.json({ error: "currency" }, { status: 400 });
  }
  await ensureSchema();
  await sql()`insert into user_prefs (user_email, currency) values (${session.user.email},${currency})
    on conflict (user_email) do update set currency=${currency}, updated_at=now()`;
  return NextResponse.json({ ok: true });
}
