import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureSchema, sql } from "@/lib/db";

/** Toggle: fuegt das Item der ersten Collection hinzu (legt "Gespeichert" an,
    falls keine existiert) oder entfernt es, wenn schon gespeichert. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "auth" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const key = String(b.item_key || "").trim().slice(0, 300);
  if (!key) return NextResponse.json({ error: "item_key" }, { status: 400 });
  await ensureSchema();
  const q = sql();
  const email = session.user.email;

  const existing = await q`select ci.collection_id from collection_items ci
    join collections c on c.id=ci.collection_id
    where c.user_email=${email} and ci.item_key=${key}`;
  if (existing.length) {
    await q`delete from collection_items where item_key=${key}
      and collection_id in (select id from collections where user_email=${email})`;
    return NextResponse.json({ saved: false });
  }
  let [col] = await q`select id from collections where user_email=${email} order by created_at limit 1`;
  if (!col) {
    [col] = await q`insert into collections (user_email,name) values (${email},'Gespeichert') returning id`;
  }
  await q`insert into collection_items (collection_id,item_key,item_name,item_image,item_price)
    values (${col.id},${key},${String(b.item_name || "").slice(0, 160) || null},
      ${String(b.item_image || "").slice(0, 400) || null},${String(b.item_price || "").slice(0, 60) || null})
    on conflict do nothing`;
  return NextResponse.json({ saved: true });
}
