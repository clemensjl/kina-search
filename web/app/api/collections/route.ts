import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureSchema, sql } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "auth" }, { status: 401 });
  await ensureSchema();
  const q = sql();
  const cols = await q`select id,name from collections
    where user_email=${session.user.email} order by created_at`;
  const items = cols.length
    ? await q`select ci.* from collection_items ci
        join collections c on c.id=ci.collection_id
        where c.user_email=${session.user.email} order by ci.added_at desc`
    : [];
  return NextResponse.json({ collections: cols, items });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { name } = await request.json().catch(() => ({}));
  const n = String(name || "").trim();
  if (!n || n.length > 60) return NextResponse.json({ error: "name" }, { status: 400 });
  await ensureSchema();
  const [row] = await sql()`insert into collections (user_email,name)
    values (${session.user.email},${n}) returning id,name`;
  return NextResponse.json(row);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "auth" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id" }, { status: 400 });
  await ensureSchema();
  await sql()`delete from collections where id=${id} and user_email=${session.user.email}`;
  return NextResponse.json({ ok: true });
}
