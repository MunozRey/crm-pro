-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Contacts ──────────────────────────────────────────────────────────────────
create table if not exists public.contacts (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  first_name    text not null,
  last_name     text not null,
  email         text,
  phone         text,
  job_title     text,
  company_id    uuid references public.companies(id) on delete set null,
  status        text not null default 'lead',
  source        text not null default 'other',
  score         integer not null default 50,
  tags          text[] not null default '{}',
  notes         text,
  assigned_to   uuid references auth.users(id) on delete set null,
  created_by    uuid references auth.users(id) on delete set null,
  last_contacted_at timestamptz,
  custom_fields jsonb not null default '{}'
);

-- ─── Companies ─────────────────────────────────────────────────────────────────
create table if not exists public.companies (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  name         text not null,
  industry     text,
  size         text,
  country      text,
  city         text,
  website      text,
  revenue      numeric,
  status       text not null default 'prospect',
  tags         text[] not null default '{}',
  notes        text,
  created_by   uuid references auth.users(id) on delete set null,
  custom_fields jsonb not null default '{}'
);

-- Add FK from contacts to companies (after companies table created)
alter table public.contacts
  add constraint fk_contacts_company
  foreign key (company_id) references public.companies(id) on delete set null;

-- ─── Deals ─────────────────────────────────────────────────────────────────────
create table if not exists public.deals (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  title               text not null,
  value               numeric not null default 0,
  stage               text not null default 'lead',
  probability         integer not null default 10,
  expected_close_date date,
  contact_id          uuid references public.contacts(id) on delete set null,
  company_id          uuid references public.companies(id) on delete set null,
  assigned_to         uuid references auth.users(id) on delete set null,
  priority            text not null default 'medium',
  source              text,
  notes               text,
  quote_items         jsonb not null default '[]',
  created_by          uuid references auth.users(id) on delete set null,
  custom_fields       jsonb not null default '{}'
);

-- ─── Activities ────────────────────────────────────────────────────────────────
create table if not exists public.activities (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  type         text not null,
  subject      text not null,
  description  text,
  status       text not null default 'pending',
  deal_id      uuid references public.deals(id) on delete cascade,
  contact_id   uuid references public.contacts(id) on delete cascade,
  company_id   uuid references public.companies(id) on delete cascade,
  due_date     timestamptz,
  completed_at timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  assigned_to  uuid references auth.users(id) on delete set null,
  outcome      text
);

-- ─── Notifications ─────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  type        text not null,
  title       text not null,
  message     text not null,
  entity_type text,
  entity_id   uuid,
  user_id     uuid references auth.users(id) on delete cascade,
  is_read     boolean not null default false
);

-- ─── Updated_at trigger ────────────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.contacts
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.companies
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.deals
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.activities
  for each row execute function public.handle_updated_at();

-- ─── Row Level Security ────────────────────────────────────────────────────────
alter table public.contacts enable row level security;
alter table public.companies enable row level security;
alter table public.deals enable row level security;
alter table public.activities enable row level security;
alter table public.notifications enable row level security;

-- Authenticated users can read all CRM data (team access)
create policy "authenticated_read_contacts" on public.contacts
  for select using (auth.role() = 'authenticated');
create policy "authenticated_write_contacts" on public.contacts
  for all using (auth.role() = 'authenticated');

create policy "authenticated_read_companies" on public.companies
  for select using (auth.role() = 'authenticated');
create policy "authenticated_write_companies" on public.companies
  for all using (auth.role() = 'authenticated');

create policy "authenticated_read_deals" on public.deals
  for select using (auth.role() = 'authenticated');
create policy "authenticated_write_deals" on public.deals
  for all using (auth.role() = 'authenticated');

create policy "authenticated_read_activities" on public.activities
  for select using (auth.role() = 'authenticated');
create policy "authenticated_write_activities" on public.activities
  for all using (auth.role() = 'authenticated');

-- ─── Navigation Preferences ────────────────────────────────────────────────
create table if not exists public.navigation_preferences (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  unique (organization_id, user_id)
);
alter table public.navigation_preferences enable row level security;
create trigger set_updated_at_navigation_preferences before update on public.navigation_preferences
  for each row execute function public.handle_updated_at();
create policy "authenticated_read_navigation_preferences" on public.navigation_preferences
  for select using (auth.role() = 'authenticated' and auth.uid() = user_id);
create policy "authenticated_write_navigation_preferences" on public.navigation_preferences
  for all using (auth.role() = 'authenticated' and auth.uid() = user_id);

-- Notifications: users only see their own
create policy "own_notifications" on public.notifications
  for all using (auth.uid() = user_id);

-- ─── Gmail Tokens ─────────────────────────────────────────────────────────────
-- Stores server-side refresh tokens for Gmail OAuth. Access tokens are NEVER stored here.
CREATE TABLE IF NOT EXISTS public.gmail_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address text NOT NULL,
  refresh_token text NOT NULL,
  access_token text,
  token_expiry timestamptz,
  scopes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own gmail tokens"
  ON public.gmail_tokens FOR ALL
  USING (auth.uid() = user_id);
