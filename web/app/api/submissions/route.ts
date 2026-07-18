import { NextResponse } from "next/server";
import { auth, isAdmin } from "@/auth";
import { ensureSchema, sql, validSubmission } from "@/lib/db";

export async function GET(request: Request) {
  await ensureSchema();
  const q = sql();
  const scope = new URL(request.url).searchParams.get("scope") || "approved";
  if (scope === "approved") {
    const rows = await q`select id,name,url,price,category,image_url from submissions
      where status='approved' order by created_at desc limit 2000`;
    return NextResponse.json(rows);
  }
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (scope === "mine") {
    const rows = await q`select id,name,url,status,created_at from submissions
      where user_email=${session.user.email} order by created_at desc limit 50`;
    return NextResponse.json(rows);
  }
  if (scope === "pending") {
    if (!isAdmin(session.user.email)) return NextResponse.json({ error: "admin" }, { status: 403 });
    const rows = await q`select * from submissions where status='pending' order by created_at`;
    return NextResponse.json(rows);
  }
  return NextResponse.json({ error: "scope" }, { status: 400 });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "auth" }, { status: 401 });
  const body = validSubmission(await request.json().catch(() => ({})));
  if (!body) return NextResponse.json({ error: "Eingaben pruefen" }, { status: 400 });
  await ensureSchema();
  const q = sql();
  const [{ count }] = await q`select count(*)::int as count from submissions
    where user_email=${session.user.email} and status='pending'`;
  if (count >= 20) {
    return NextResponse.json({ error: "Zu viele offene Einreichungen - warte auf Freigabe." }, { status: 429 });
  }
  await q`insert into submissions (user_email,name,url,price,category,image_url,note)
    values (${session.user.email},${body.name},${body.url},${body.price},${body.category},${body.image_url},${body.note})`;
  return NextResponse.json({ ok: true });
}
