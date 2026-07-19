import { neon } from "@neondatabase/serverless";

// Neon-Connection; DATABASE_URL kommt aus der Vercel-Neon-Integration.
export function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL fehlt");
  return neon(url);
}

let initialized = false;

/** Legt Tabellen idempotent an (Neon Free hat keine Migrations-Pipeline noetig). */
export async function ensureSchema() {
  if (initialized) return;
  const q = sql();
  await q`create table if not exists submissions (
    id uuid primary key default gen_random_uuid(),
    user_email text not null,
    name text not null,
    url text not null,
    price text,
    category text not null,
    image_url text,
    note text,
    status text not null default 'pending',
    created_at timestamptz not null default now(),
    reviewed_at timestamptz
  )`;
  await q`create table if not exists verified_items (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    url text not null,
    price text,
    category text,
    image_url text,
    rating numeric(3,1) not null,
    note text,
    created_at timestamptz not null default now()
  )`;
  await q`create table if not exists collections (
    id uuid primary key default gen_random_uuid(),
    user_email text not null,
    name text not null,
    created_at timestamptz not null default now()
  )`;
  await q`create table if not exists user_prefs (
    user_email text primary key,
    currency text not null default 'EUR',
    updated_at timestamptz not null default now()
  )`;
  await q`alter table user_prefs add column if not exists language text`;
  await q`alter table user_prefs add column if not exists theme text`;
  await q`alter table user_prefs add column if not exists agent text`;
  await q`create table if not exists collection_items (
    collection_id uuid not null references collections(id) on delete cascade,
    item_key text not null,
    item_name text,
    item_image text,
    item_price text,
    added_at timestamptz not null default now(),
    primary key (collection_id, item_key)
  )`;
  initialized = true;
}

const URL_RE = /^https?:\/\//i;

export function validSubmission(b: Record<string, unknown>) {
  const name = String(b.name || "").trim();
  const url = String(b.url || "").trim();
  const category = String(b.category || "").trim();
  if (name.length < 3 || name.length > 160) return null;
  if (!URL_RE.test(url) || url.length > 500) return null;
  if (!category || category.length > 40) return null;
  const price = String(b.price || "").trim().slice(0, 60) || null;
  const image_url = String(b.image_url || "").trim() || null;
  if (image_url && !URL_RE.test(image_url)) return null;
  const note = String(b.note || "").trim().slice(0, 500) || null;
  return { name, url, category, price, image_url, note };
}
