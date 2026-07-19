-- ============================================================
-- EVENT WALL — DATABASE SETUP
-- Run this whole file once in Supabase: SQL Editor > New query > paste > Run
-- Safe to re-run: every statement below is idempotent.
-- ============================================================

-- 1. TABLES ---------------------------------------------------

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  name text,
  body text not null check (char_length(body) <= 2000),
  image_path text,
  created_at timestamptz not null default now(),
  like_count integer not null default 0,
  comment_count integer not null default 0,
  report_count integer not null default 0,
  hidden boolean not null default false,
  device_id text
);

-- If you're re-running this on a database created before device_id
-- existed, this adds it without touching your existing posts.
alter table posts add column if not exists device_id text;

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  name text,
  body text not null check (char_length(body) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on posts (created_at desc);
create index if not exists posts_device_id_idx on posts (device_id);
create index if not exists comments_post_id_idx on comments (post_id);

-- 2. ROW LEVEL SECURITY ---------------------------------------
-- "authenticated" = someone logged in with the shared admin login.
-- Everyone else (site visitors) is "anon".

alter table posts enable row level security;
alter table comments enable row level security;

drop policy if exists "public read visible posts" on posts;
create policy "public read visible posts" on posts
  for select using ( hidden = false or auth.role() = 'authenticated' );

drop policy if exists "anyone can create a post" on posts;
create policy "anyone can create a post" on posts
  for insert with check ( true );

drop policy if exists "admin can update posts" on posts;
create policy "admin can update posts" on posts
  for update using ( auth.role() = 'authenticated' );

-- Only the logged-in admin can delete posts directly through the table.
-- Guests deleting their own post go through the delete_my_post()
-- function below instead, which checks device_id ownership.
drop policy if exists "admin can delete posts" on posts;
create policy "admin can delete posts" on posts
  for delete using ( auth.role() = 'authenticated' );

drop policy if exists "anyone can read comments" on comments;
create policy "anyone can read comments" on comments
  for select using ( true );

drop policy if exists "anyone can create a comment" on comments;
create policy "anyone can create a comment" on comments
  for insert with check ( true );

drop policy if exists "admin can delete comments" on comments;
create policy "admin can delete comments" on comments
  for delete using ( auth.role() = 'authenticated' );

-- 3. ATOMIC COUNTER FUNCTIONS -----------------------------------
-- These run as "security definer" so a plain visitor (anon) can
-- safely bump a counter without being able to edit posts directly.
-- The updates are single SQL statements, so they stay correct even
-- if hundreds of people tap Like at the same second.

create or replace function increment_like(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update posts set like_count = like_count + 1 where id = p_id;
end;
$$;

-- Un-liking a post. Guards against going below zero if someone
-- races the button on two tabs.
create or replace function decrement_like(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update posts
  set like_count = greatest(0, like_count - 1)
  where id = p_id;
end;
$$;

create or replace function increment_comment_count(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update posts set comment_count = comment_count + 1 where id = p_id;
end;
$$;

-- Reporting: bumps report_count, and auto-hides the post once it
-- reaches 3 reports so an admin can review it.
create or replace function report_post(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update posts
  set report_count = report_count + 1,
      hidden = case when report_count + 1 >= 3 then true else hidden end
  where id = p_id;
end;
$$;

-- Lets a guest delete only the post their own browser created,
-- verified by matching device_id — without granting a general
-- anon delete policy on the table. Comments cascade automatically
-- (see the foreign key above). Returns the deleted row's
-- image_path so the client can also clean up Storage.
create or replace function delete_my_post(p_post_id uuid, p_device_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_image_path text;
begin
  if p_device_id is null or p_device_id = '' then
    raise exception 'device id required';
  end if;

  delete from posts
  where id = p_post_id
    and device_id = p_device_id
  returning image_path into v_image_path;

  if not found then
    raise exception 'post not found or not owned by this device';
  end if;

  return v_image_path;
end;
$$;

grant execute on function increment_like(uuid) to anon, authenticated;
grant execute on function decrement_like(uuid) to anon, authenticated;
grant execute on function increment_comment_count(uuid) to anon, authenticated;
grant execute on function report_post(uuid) to anon, authenticated;
grant execute on function delete_my_post(uuid, text) to anon, authenticated;

-- ============================================================
-- After running this file, go create the "post-images" Storage
-- bucket and its policies — that part is in setup_storage.sql
-- (it has to run after the bucket exists, see the guide).
-- ============================================================
