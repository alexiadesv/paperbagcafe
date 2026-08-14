create extension if not exists pgcrypto;

create type public.package_status as enum ('draft', 'sealed', 'sent', 'opened');

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  public_slug text not null unique default encode(gen_random_bytes(18), 'hex'),
  status public.package_status not null default 'draft',
  selected_activities text[] not null,
  activities jsonb not null default '{}'::jsonb,
  letter jsonb not null default '{}'::jsonb,
  bag jsonb not null default '{}'::jsonb,
  receipt jsonb,
  active_seconds integer not null default 0 check (active_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sealed_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  constraint at_least_one_activity check (cardinality(selected_activities) >= 1),
  constraint valid_activities check (
    selected_activities <@ array['latte','tart','toast','letter','watercolor','nameTag']::text[]
  ),
  constraint bag_names_are_short check (
    char_length(coalesce(bag->>'to', '')) <= 80
    and char_length(coalesce(bag->>'from', '')) <= 80
  ),
  constraint letter_is_short check (
    char_length(coalesce(letter->>'body', '')) <= 4000
  )
);

create index packages_owner_idx on public.packages(owner_id);
create index packages_public_slug_idx on public.packages(public_slug);

create function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger packages_touch_updated_at
before update on public.packages
for each row execute function public.touch_updated_at();

alter table public.packages enable row level security;

create policy "owners create packages"
on public.packages for insert
to authenticated
with check (owner_id = auth.uid() and status in ('draft', 'sealed'));

create policy "owners read packages"
on public.packages for select
to authenticated
using (owner_id = auth.uid());

create policy "owners update unsent packages"
on public.packages for update
to authenticated
using (owner_id = auth.uid() and status in ('draft', 'sealed'))
with check (owner_id = auth.uid() and status in ('draft', 'sealed'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('package-media', 'package-media', false, 524288, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "owners upload package media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'package-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "owners update package media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'package-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'package-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "owners read package media"
on storage.objects for select
to authenticated
using (
  bucket_id = 'package-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.send_package(
  p_package_id uuid,
  p_activities jsonb,
  p_receipt jsonb,
  p_active_seconds integer
)
returns table (public_slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  package_row public.packages;
begin
  select * into package_row
  from public.packages
  where id = p_package_id
    and owner_id = auth.uid()
    and status = 'sealed'
  for update;

  if package_row.id is null then
    raise exception 'Package is not ready to send';
  end if;
  if nullif(trim(package_row.bag->>'to'), '') is null
     or nullif(trim(package_row.bag->>'from'), '') is null then
    raise exception 'To and from names are required';
  end if;
  if p_active_seconds < 0 or p_active_seconds > 2592000 then
    raise exception 'Invalid active time';
  end if;

  update public.packages
  set activities = p_activities,
      receipt = p_receipt,
      active_seconds = p_active_seconds,
      status = 'sent',
      sent_at = now()
  where id = p_package_id
  returning packages.public_slug into public_slug;

  return next;
end;
$$;

revoke all on function public.send_package(uuid, jsonb, jsonb, integer) from public;
grant execute on function public.send_package(uuid, jsonb, jsonb, integer) to authenticated;
