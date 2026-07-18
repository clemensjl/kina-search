import { NextResponse } from "next/server";
import { auth, isAdmin } from "@/auth";
import { ensureSchema, sql } from "@/lib/db";

export async function GET() {
  await ensureSchema();
  const rows = await sql()`select * from verified_items order by created_at desc limit 1000`;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) return NextResponse.json({ error: "admin" }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const name = String(b.name || "").trim();
  const url = String(b.url || "").trim();
  const rating = Number(b.rating);
  if (name.length < 3 || !/^https?:\/\//.test(url) || isNaN(rating) || rating < 0 || rating > 10) {
    return NextResponse.json({ error: "Eingaben pruefen" }, { status: 400 });
  }
  await ensureSchema();
  await sql()`insert into verified_items (name,url,price,category,image_url,rating,note) values (
    ${name},${url},${String(b.price || "").slice(0, 60) || null},${String(b.category || "").slice(0, 40) || null},
    ${String(b.image_url || "").trim() || null},${rating},${String(b.note || "").slice(0, 1000) || null})`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) return NextResponse.json({ error: "admin" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id" }, { status: 400 });
  await ensureSchema();
  await sql()`delete from verified_items where id=${id}`;
  return NextResponse.json({ ok: true });
}
