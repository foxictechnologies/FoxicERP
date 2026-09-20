-- =========================================================================
-- PATCH: Enquiries & Tickets Table (Bulletproof Setup)
-- Run this query in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- =========================================================================

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  ticket_number text,
  name text not null,
  email text,
  phone text,
  subject text not null,
  message text not null,
  source text default 'Website',
  status text not null default 'new',       -- 'new', 'in_progress', 'resolved'
  priority text not null default 'normal',  -- 'normal', 'high', 'urgent'
  assigned_to uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_tickets_company_id on tickets(company_id);
create index if not exists idx_tickets_status on tickets(status);
create index if not exists idx_tickets_created_at on tickets(created_at);

-- Auto-generate ticket number sequence trigger if not provided
create or replace function set_ticket_number() returns trigger as $$
declare
  next_num bigint;
begin
  if new.ticket_number is null or new.ticket_number = '' then
    select count(*) + 1001 into next_num from tickets;
    new.ticket_number := 'TCK-' || coalesce(next_num, 1001);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_ticket_number on tickets;
create trigger trg_set_ticket_number before insert on tickets
  for each row execute function set_ticket_number();

-- Enable Row Level Security
alter table tickets enable row level security;

-- 1. All authenticated users can VIEW all tickets (avoids company_id mismatch blocking)
drop policy if exists "company view tickets" on tickets;
drop policy if exists "auth view tickets" on tickets;
create policy "auth view tickets" on tickets
  for select using (auth.role() = 'authenticated');

-- 2. Anyone (including anonymous website contact forms) can INSERT tickets
drop policy if exists "company insert tickets" on tickets;
drop policy if exists "anyone insert tickets" on tickets;
create policy "anyone insert tickets" on tickets
  for insert with check (true);

-- 3. Authenticated users can UPDATE tickets
drop policy if exists "company update tickets" on tickets;
drop policy if exists "auth update tickets" on tickets;
create policy "auth update tickets" on tickets
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 4. Authenticated users can DELETE tickets
drop policy if exists "company delete tickets" on tickets;
drop policy if exists "auth delete tickets" on tickets;
create policy "auth delete tickets" on tickets
  for delete using (auth.role() = 'authenticated');

-- Enable Realtime for tickets table
alter publication supabase_realtime add table tickets;
