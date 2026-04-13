-- Quick replies/snippets per user (private mailbox productivity).

create table if not exists public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quick_replies_org_user
  on public.quick_replies (organization_id, user_id, updated_at desc);

alter table public.quick_replies enable row level security;

drop policy if exists "user_read_quick_replies" on public.quick_replies;
create policy "user_read_quick_replies"
  on public.quick_replies
  for select
  using (organization_id = public.get_org_id() and user_id = auth.uid());

drop policy if exists "user_write_quick_replies" on public.quick_replies;
create policy "user_write_quick_replies"
  on public.quick_replies
  for all
  using (organization_id = public.get_org_id() and user_id = auth.uid())
  with check (organization_id = public.get_org_id() and user_id = auth.uid());
