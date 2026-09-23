-- =========================================================================
-- SCHEMA PATCH: CASCADE / SET NULL DELETE FOR PROFILES & TEAM MEMBERS
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Fixes FK constraint errors when deleting team members in Supabase
-- =========================================================================

-- 1. Invoices: Set created_by to NULL on profile deletion
alter table if exists invoices drop constraint if exists invoices_created_by_fkey;
alter table if exists invoices add constraint invoices_created_by_fkey foreign key (created_by) references profiles(id) on delete set null;

-- 2. Purchases: Set created_by to NULL on profile deletion
alter table if exists purchases drop constraint if exists purchases_created_by_fkey;
alter table if exists purchases add constraint purchases_created_by_fkey foreign key (created_by) references profiles(id) on delete set null;

-- 3. Payments: Set created_by to NULL on profile deletion
alter table if exists payments drop constraint if exists payments_created_by_fkey;
alter table if exists payments add constraint payments_created_by_fkey foreign key (created_by) references profiles(id) on delete set null;

-- 4. Expenses: Set created_by to NULL on profile deletion
alter table if exists expenses drop constraint if exists expenses_created_by_fkey;
alter table if exists expenses add constraint expenses_created_by_fkey foreign key (created_by) references profiles(id) on delete set null;

-- 5. Audit Log: Delete audit log entries or set NULL on profile deletion
alter table if exists audit_log drop constraint if exists audit_log_user_id_fkey;
alter table if exists audit_log add constraint audit_log_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;

-- 6. Tickets: Set assigned_to to NULL on profile deletion
alter table if exists tickets drop constraint if exists tickets_assigned_to_fkey;
alter table if exists tickets add constraint tickets_assigned_to_fkey foreign key (assigned_to) references profiles(id) on delete set null;

-- 7. Tasks: Set assigned_to & created_by to NULL on profile deletion
alter table if exists tasks drop constraint if exists tasks_assigned_to_fkey;
alter table if exists tasks add constraint tasks_assigned_to_fkey foreign key (assigned_to) references profiles(id) on delete set null;

alter table if exists tasks drop constraint if exists tasks_created_by_fkey;
alter table if exists tasks add constraint tasks_created_by_fkey foreign key (created_by) references profiles(id) on delete set null;

-- 8. Profiles: Ensure Owner full management RLS policy is active
drop policy if exists "owner manages team" on profiles;
create policy "owner manages team" on profiles for all 
using (my_role() = 'Owner' and company_id = my_company());
