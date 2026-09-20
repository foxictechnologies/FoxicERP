-- =========================================================================
-- PATCH: Email Inbox & Gmail Integration for info@foxic.in
-- Run this query in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- =========================================================================

-- 1. Table for Synced & Received Emails
create table if not exists emails (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  account_email text not null default 'info@foxic.in',
  message_id text,
  thread_id text,
  sender_name text not null,
  sender_email text not null,
  recipient_email text not null default 'info@foxic.in',
  subject text not null default '(No Subject)',
  snippet text default '',
  body_html text default '',
  body_text text default '',
  is_read boolean not null default false,
  is_starred boolean not null default false,
  folder text not null default 'inbox', -- 'inbox', 'sent', 'starred', 'trash', 'archive'
  category text default 'General', -- 'Inquiries', 'Billing', 'Support', 'General'
  attachments jsonb default '[]'::jsonb, -- array of { name, size, type, data }
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure columns exist if table was previously created
alter table emails add column if not exists company_id uuid references companies(id) on delete cascade;
alter table emails add column if not exists account_email text default 'info@foxic.in';
alter table emails add column if not exists message_id text;
alter table emails add column if not exists thread_id text;
alter table emails add column if not exists sender_name text;
alter table emails add column if not exists sender_email text;
alter table emails add column if not exists recipient_email text default 'info@foxic.in';
alter table emails add column if not exists subject text default '(No Subject)';
alter table emails add column if not exists snippet text default '';
alter table emails add column if not exists body_html text default '';
alter table emails add column if not exists body_text text default '';
alter table emails add column if not exists is_read boolean default false;
alter table emails add column if not exists is_starred boolean default false;
alter table emails add column if not exists folder text default 'inbox';
alter table emails add column if not exists category text default 'General';
alter table emails add column if not exists attachments jsonb default '[]'::jsonb;
alter table emails add column if not exists received_at timestamptz default now();

-- 2. Table for OAuth 2.0 Integration Config (Securely stored in backend)
create table if not exists email_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  account_email text not null default 'info@foxic.in',
  provider text not null default 'gmail',
  client_id text,
  access_token text,
  refresh_token text,
  token_expiry bigint,
  sync_status text default 'connected', -- 'connected', 'pending', 'error', 'disconnected'
  last_synced_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_email_integration_company unique (company_id, account_email)
);

-- Indexes for performance
create index if not exists idx_emails_company_id on emails(company_id);
create index if not exists idx_emails_account on emails(account_email);
create index if not exists idx_emails_folder on emails(folder);
create index if not exists idx_emails_is_read on emails(is_read);
create index if not exists idx_emails_received_at on emails(received_at desc);
create index if not exists idx_email_integrations_company on email_integrations(company_id);

-- Enable Row Level Security
alter table emails enable row level security;
alter table email_integrations enable row level security;

-- Policies for emails (company-scoped)
drop policy if exists "company view emails" on emails;
create policy "company view emails" on emails
  for select using (company_id = my_company());

drop policy if exists "company insert emails" on emails;
create policy "company insert emails" on emails
  for insert with check (company_id = my_company());

drop policy if exists "company update emails" on emails;
create policy "company update emails" on emails
  for update using (company_id = my_company()) with check (company_id = my_company());

drop policy if exists "company delete emails" on emails;
create policy "company delete emails" on emails
  for delete using (company_id = my_company());

-- Policies for email_integrations (company-scoped)
drop policy if exists "company view email_integrations" on email_integrations;
create policy "company view email_integrations" on email_integrations
  for select using (company_id = my_company());

drop policy if exists "company insert email_integrations" on email_integrations;
create policy "company insert email_integrations" on email_integrations
  for insert with check (company_id = my_company());

drop policy if exists "company update email_integrations" on email_integrations;
create policy "company update email_integrations" on email_integrations
  for update using (company_id = my_company()) with check (company_id = my_company());

drop policy if exists "company delete email_integrations" on email_integrations;
create policy "company delete email_integrations" on email_integrations
  for delete using (company_id = my_company());
