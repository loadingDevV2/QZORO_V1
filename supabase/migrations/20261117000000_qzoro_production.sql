-- QZORO production schema.
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL editor.
-- The app uses the signed-in user's JWT for every query, so RLS is the tenant boundary.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users created before this migration.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do update set email = excluded.email;

-- ---------------------------------------------------------------------------
-- Per-user desk settings and encrypted provider keys
-- ---------------------------------------------------------------------------

create table if not exists public.desk_settings (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  provider text not null default 'gemini'
    check (provider in ('gemini', 'openai', 'anthropic', 'opencode')),
  models jsonb not null default '{}'::jsonb,
  account jsonb not null default '{}'::jsonb,
  instrument jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists desk_settings_set_updated_at on public.desk_settings;
create trigger desk_settings_set_updated_at
  before update on public.desk_settings
  for each row execute function public.set_updated_at();

create table if not exists public.provider_keys (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  provider text not null
    check (provider in ('gemini', 'openai', 'anthropic', 'opencode')),
  ciphertext text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

drop trigger if exists provider_keys_set_updated_at on public.provider_keys;
create trigger provider_keys_set_updated_at
  before update on public.provider_keys
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Filed chart reviews
-- ---------------------------------------------------------------------------

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  provider text not null,
  model text not null,
  demo boolean not null default false,
  timeframe text not null default '',
  verdict text not null default 'stood-down'
    check (verdict in ('cleared', 'wait', 'stood-down')),
  direction text not null default 'none'
    check (direction in ('long', 'short', 'none')),
  setup_name text not null default '',
  confidence integer not null default 0 check (confidence between 0 and 100),
  payload_json jsonb not null,
  image_path text,
  image_mime text
);

create index if not exists analyses_user_created_idx
  on public.analyses (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  trade_date date not null,
  symbol text not null default 'XAUUSD',
  direction text not null check (direction in ('long', 'short')),
  setup text not null default '',
  entry numeric(18, 6) not null,
  stop_loss numeric(18, 6) not null,
  take_profit numeric(18, 6) not null,
  exit_price numeric(18, 6),
  lots numeric(18, 4) not null,
  risk_usd numeric(18, 2) not null,
  risk_pct numeric(8, 4) not null default 0,
  planned_rr numeric(12, 4) not null default 0,
  result text not null default 'open'
    check (result in ('open', 'win', 'loss', 'breakeven')),
  r_multiple numeric(12, 4),
  pnl_usd numeric(18, 2),
  notes text not null default '',
  analysis_id uuid references public.analyses (id) on delete set null,
  followed_plan boolean not null default true,
  source text not null default 'manual'
    check (source in ('manual', 'analysis', 'sample')),
  unique (user_id, analysis_id)
);

create index if not exists trades_user_date_idx
  on public.trades (user_id, trade_date desc, created_at desc);

create index if not exists trades_user_result_idx
  on public.trades (user_id, result);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.desk_settings enable row level security;
alter table public.provider_keys enable row level security;
alter table public.analyses enable row level security;
alter table public.trades enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists desk_settings_own on public.desk_settings;
create policy desk_settings_own
  on public.desk_settings for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists provider_keys_own on public.provider_keys;
create policy provider_keys_own
  on public.provider_keys for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists analyses_own on public.analyses;
create policy analyses_own
  on public.analyses for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists trades_own on public.trades;
create policy trades_own
  on public.trades for all
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      analysis_id is null
      or exists (
        select 1
        from public.analyses a
        where a.id = analysis_id
          and a.user_id = auth.uid()
      )
    )
  );

revoke all on public.profiles from anon;
revoke all on public.desk_settings from anon;
revoke all on public.provider_keys from anon;
revoke all on public.analyses from anon;
revoke all on public.trades from anon;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.desk_settings to authenticated;
grant select, insert, update, delete on public.provider_keys to authenticated;
grant select, insert, update, delete on public.analyses to authenticated;
grant select, insert, update, delete on public.trades to authenticated;

-- Trigger helpers should not be callable through PostgREST.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Clear both tables in one transaction and return every chart path in one
-- JSON array. This avoids partially cleared journals and PostgREST row caps.
create or replace function public.clear_journal()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  paths jsonb;
begin
  with removed as (
    delete from public.analyses
    where user_id = auth.uid()
    returning image_path
  )
  select coalesce(jsonb_agg(image_path), '[]'::jsonb)
  into paths
  from removed
  where image_path is not null;

  delete from public.trades where user_id = auth.uid();

  return paths;
end;
$$;

revoke all on function public.clear_journal() from public, anon;
grant execute on function public.clear_journal() to authenticated;

-- ---------------------------------------------------------------------------
-- Private chart bucket
-- Path convention: <auth uid>/<analysis uuid>.<jpg|png|webp>
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'charts',
  'charts',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists charts_insert_own on storage.objects;
create policy charts_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'charts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists charts_select_own on storage.objects;
create policy charts_select_own
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'charts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists charts_update_own on storage.objects;
create policy charts_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'charts'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'charts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists charts_delete_own on storage.objects;
create policy charts_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'charts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
