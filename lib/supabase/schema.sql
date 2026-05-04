-- Norte CRM — Supabase Schema
-- Run this in the Supabase SQL Editor

-- ─── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Pipeline Stages ──────────────────────────────────────────
create table if not exists pipeline_stages (
  id          text        not null,
  label       text        not null,
  color       text        not null default 'oklch(65% 0.13 260)',
  position    integer     not null default 0,
  user_id     uuid        not null references auth.users on delete cascade,
  primary key (id, user_id)
);

alter table pipeline_stages enable row level security;
create policy "Own stages" on pipeline_stages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Companies ────────────────────────────────────────────────
create table if not exists companies (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  user_id     uuid        not null references auth.users on delete cascade,
  name        text        not null,
  industry    text,
  website     text,
  city        text,
  country     text,
  notes       text
);

alter table companies enable row level security;
create policy "Own companies" on companies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Contacts ─────────────────────────────────────────────────
create table if not exists contacts (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  user_id     uuid        not null references auth.users on delete cascade,
  name        text        not null,
  company     text,
  company_id  uuid        references companies(id) on delete set null,
  role        text,
  email       text,
  phone       text,
  city        text,
  rubro       text,
  website     text,
  status      text        not null default 'lead'
                          check (status in ('cliente','oportunidad','lead','archivado','enviado','no_enviado','interesado','enviar_mail')),
  tags        text[]      not null default '{}',
  last_touch  timestamptz default now(),
  owner_name  text,
  value       numeric     not null default 0
);

alter table contacts enable row level security;
create policy "Own contacts" on contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists contacts_user_status on contacts(user_id, status);
create index if not exists contacts_user_name   on contacts(user_id, name);

-- ─── Deals ────────────────────────────────────────────────────
create table if not exists deals (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  user_id     uuid        not null references auth.users on delete cascade,
  title       text        not null,
  contact_id  uuid        references contacts(id) on delete set null,
  stage_id    text        not null default 'enviado',
  amount      numeric     not null default 0,
  probability integer     not null default 20
                          check (probability >= 0 and probability <= 100),
  close_date  date,
  owner_name  text,
  position    integer     not null default 0
);

alter table deals enable row level security;
create policy "Own deals" on deals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists deals_user_stage on deals(user_id, stage_id);

-- ─── Tasks ────────────────────────────────────────────────────
create table if not exists tasks (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  user_id     uuid        not null references auth.users on delete cascade,
  title       text        not null,
  due_label   text,
  due_date    timestamptz,
  priority    text        not null default 'media'
                          check (priority in ('alta','media','baja')),
  done        boolean     not null default false,
  contact_id  uuid        references contacts(id) on delete set null,
  deal_id     uuid        references deals(id) on delete set null,
  task_type   text
);

alter table tasks enable row level security;
create policy "Own tasks" on tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists tasks_user_done on tasks(user_id, done);

-- ─── Activities ───────────────────────────────────────────────
create table if not exists activities (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  user_id     uuid        not null references auth.users on delete cascade,
  kind        text        not null
                          check (kind in ('email_in','email_out','call_out','meeting','note','invoice','stage_change')),
  who         text,
  body        text,
  contact_id  uuid        references contacts(id) on delete cascade,
  deal_id     uuid        references deals(id) on delete cascade
);

alter table activities enable row level security;
create policy "Own activities" on activities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists activities_contact on activities(contact_id, created_at desc);
create index if not exists activities_deal    on activities(deal_id, created_at desc);

-- ─── Team Members ─────────────────────────────────────────────
create table if not exists team_members (
  id              uuid    primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  owner_id        uuid    not null references auth.users on delete cascade,
  name            text    not null,
  email           text,
  phone           text,
  role            text    not null default 'Vendedor',
  permission      text    not null default 'vendedor'
                          check (permission in ('admin','manager','vendedor','sdr','viewer')),
  tone            text    not null default 'accent',
  status          text    not null default 'activo'
                          check (status in ('activo','inactivo','invitado')),
  quota           numeric not null default 0,
  sold            numeric not null default 0,
  deals_count     integer not null default 0,
  win_rate        integer not null default 0,
  region          text,
  joined_label    text
);

alter table team_members enable row level security;
create policy "Own team" on team_members for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─── Inbox Messages ───────────────────────────────────────────
create table if not exists inbox_messages (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  user_id     uuid        not null references auth.users on delete cascade,
  from_name   text,
  subject     text,
  preview     text,
  body        text,
  sent_label  text,
  unread      boolean     not null default true,
  starred     boolean     not null default false,
  labels      text[]      not null default '{}'
);

alter table inbox_messages enable row level security;
create policy "Own inbox" on inbox_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Realtime ─────────────────────────────────────────────────
alter publication supabase_realtime add table contacts;
alter publication supabase_realtime add table deals;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table activities;

-- ─── Seed default pipeline stages (call after first login) ────
-- Insert via app code using user_id from auth.uid()
-- Default stages for Norte CRM:
-- enviar_mail, enviado, reu_inicial, seg_reu, doc_enviada,
-- prop_enviada, ped_fc, doc_firmada, ganado, perdido
