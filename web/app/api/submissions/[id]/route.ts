import { NextResponse } from "next/server";
import { auth, isAdmin } from "@/auth";
import { ensureSchema, sql } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) return NextResponse.json({ error: "admin" }, { status: 403 });
  const { id } = await params;
  const { status } = await request.json().catch(() => ({}));
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "status" }, { status: 400 });
  }
  await ensureSchema();
  await sql()`update submissions set status=${status}, reviewed_at=now() where id=${id}`;
  return NextResponse.json({ ok: true });
}
