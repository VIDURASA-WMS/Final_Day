-- ============================================================
-- EVENT WALL — DATABASE SETUP
-- Run this whole file once in Supabase: SQL Editor > New query > paste > Run
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
  hidden boolean not null default false
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  name text,
  body text not null check (char_length(body) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on posts (created_at desc);
create index if not exists comments_post_id_idx on comments (post_id);

-- 2. ROW LEVEL SECURITY ---------------------------------------
-- "authenticated" = someone logged in with the shared admin login.
-- Everyone else (site visitors) is "anon".

alter table posts enable row level security;
alter table comments enable row level security;

-- Visitors can see posts that aren't hidden. Admins see everything.
create policy "public read visible posts" on posts
  for select using ( hidden = false or auth.role() = 'authenticated' );

-- Anyone can submit a post (this is how the public posting works).
create policy "anyone can create a post" on posts
  for insert with check ( true );

-- Only the logged-in admin can edit posts (unhide / reset reports).
create policy "admin can update posts" on posts
  for update using ( auth.role() = 'authenticated' );

-- Only the logged-in admin can delete posts.
create policy "admin can delete posts" on posts
  for delete using ( auth.role() = 'authenticated' );

-- Comments are public to read and add.
create policy "anyone can read comments" on comments
  for select using ( true );

create policy "anyone can create a comment" on comments
  for insert with check ( true );

-- Only the logged-in admin can delete a comment.
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

grant execute on function increment_like(uuid) to anon, authenticated;
grant execute on function increment_comment_count(uuid) to anon, authenticated;
grant execute on function report_post(uuid) to anon, authenticated;

-- ============================================================
-- After running this file, go create the "post-images" Storage
-- bucket and its policies — that part is in setup_storage.sql
-- (it has to run after the bucket exists, see the guide).
-- ============================================================
