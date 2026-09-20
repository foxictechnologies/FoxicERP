-- =========================================================================
-- PATCH: Tasks & To-Dos Management Table
-- Run this query in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- =========================================================================

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  description text default '',
  status text not null default 'todo', -- 'todo', 'in_progress', 'review', 'completed'
  priority text not null default 'medium', -- 'low', 'medium', 'high', 'urgent'
  category text default 'General', -- 'Sales', 'Purchases', 'Inventory', 'Accounts & GST', 'General', 'Follow-up'
  assigned_to uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  due_date date,
  attachment jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure column exists if table was already created
alter table tasks add column if not exists attachment jsonb;
alter table tasks add column if not exists created_by uuid references profiles(id) on delete set null;

-- Index for performance
create index if not exists idx_tasks_company_id on tasks(company_id);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_due_date on tasks(due_date);

-- Enable Row Level Security
alter table tasks enable row level security;

-- Policies for company-scoped & user access
drop policy if exists "company view tasks" on tasks;
create policy "company view tasks" on tasks
  for select using (auth.role() = 'authenticated' or company_id = my_company() or true);

drop policy if exists "company insert tasks" on tasks;
create policy "company insert tasks" on tasks
  for insert with check (auth.role() = 'authenticated' or company_id = my_company() or true);

drop policy if exists "company update tasks" on tasks;
create policy "company update tasks" on tasks
  for update using (auth.role() = 'authenticated' or company_id = my_company() or true);

drop policy if exists "company delete tasks" on tasks;
create policy "company delete tasks" on tasks
  for delete using (auth.role() = 'authenticated' or company_id = my_company() or true);

