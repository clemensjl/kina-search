-- kina-search Multi-User-Schema. Sicherheit via RLS; Admin = E-Mail in admin_emails.

create table admin_emails (email text primary key);
insert into admin_emails (email) values ('jele.clemens@gmail.com');

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from admin_emails where email = auth.email()) $$;

-- Einreichungen: jeder verifizierte User, sichtbar erst nach Admin-Freigabe
create table submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  name text not null check (char_length(name) between 3 and 160),
  url text not null check (url ~* '^https?://'),
  price text check (char_length(price) <= 60),
  category text not null check (char_length(category) <= 40),
  image_url text check (image_url is null or image_url ~* '^https?://'),
  note text check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table submissions enable row level security;

create policy sub_insert on submissions for insert to authenticated
  with check (auth.uid() = user_id and user_email = auth.email() and status = 'pending');
create policy sub_select on submissions for select
  using (status = 'approved' or auth.uid() = user_id or is_admin());
create policy sub_admin_update on submissions for update to authenticated
  using (is_admin()) with check (is_admin());
create policy sub_admin_delete on submissions for delete to authenticated
  using (is_admin());

-- Spam-Bremse: max 20 offene Einreichungen pro User
create or replace function check_submission_quota() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from submissions where user_id = new.user_id and status = 'pending') >= 20 then
    raise exception 'Zu viele offene Einreichungen - warte auf Freigabe.';
  end if;
  return new;
end $$;
create trigger submissions_quota before insert on submissions
  for each row execute function check_submission_quota();

-- Von uns verifiziert: nur Admin schreibt, alle lesen; Rating 0-10
create table verified_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 160),
  url text not null check (url ~* '^https?://'),
  price text check (char_length(price) <= 60),
  category text check (char_length(category) <= 40),
  image_url text check (image_url is null or image_url ~* '^https?://'),
  rating numeric(3,1) not null check (rating >= 0 and rating <= 10),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
alter table verified_items enable row level security;
create policy ver_select on verified_items for select using (true);
create policy ver_admin_write on verified_items for all to authenticated
  using (is_admin()) with check (is_admin());

-- Collections: private Item-Listen pro User
create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);
alter table collections enable row level security;
create policy col_owner on collections for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table collection_items (
  collection_id uuid not null references collections(id) on delete cascade,
  item_key text not null check (char_length(item_key) <= 300),
  item_name text check (char_length(item_name) <= 160),
  item_image text check (char_length(item_image) <= 400),
  item_price text check (char_length(item_price) <= 60),
  added_at timestamptz not null default now(),
  primary key (collection_id, item_key)
);
alter table collection_items enable row level security;
create policy ci_owner on collection_items for all to authenticated
  using (exists (select 1 from collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from collections c where c.id = collection_id and c.user_id = auth.uid()));
