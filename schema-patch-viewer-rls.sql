-- =========================================================================
-- SCHEMA PATCH: VIEWER & MANAGER FULL READ ACCESS RLS POLICIES
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Fixes Row-Level Security policies so 'Viewer' and 'Manager' roles can 
-- view all Expenses, Purchases, Payments, Invoices, Vendors, Customers, Audit Log, etc.
-- =========================================================================

-- 1. EXPENSES: Allow Viewer & Manager to view expenses
drop policy if exists "finance read expenses" on expenses;
create policy "finance read expenses" on expenses for select 
using (company_id = my_company() and my_role() in ('Owner', 'Accountant', 'Manager', 'Viewer'));

-- 2. PURCHASES: Allow Viewer & Manager to view purchases
drop policy if exists "finance read purchases" on purchases;
create policy "finance read purchases" on purchases for select 
using (company_id = my_company() and my_role() in ('Owner', 'Accountant', 'Manager', 'Viewer'));

-- 3. PAYMENTS: Allow Viewer & Manager to view payments
drop policy if exists "finance read payments" on payments;
create policy "finance read payments" on payments for select 
using (company_id = my_company() and my_role() in ('Owner', 'Accountant', 'Manager', 'Viewer'));

-- 4. INVOICES: Allow Viewer & Manager to view invoices
drop policy if exists "read invoices" on invoices;
create policy "read invoices" on invoices for select 
using (company_id = my_company() and my_role() in ('Owner', 'Accountant', 'Sales', 'Manager', 'Viewer'));

-- 4b. INVOICES: Managers can apply edits accepted from Sales requests.
alter table invoices add column if not exists pending_edit jsonb;
drop policy if exists "update invoices" on invoices;
create policy "update invoices" on invoices for update
using (company_id = my_company() and my_role() in ('Owner', 'Accountant', 'Sales', 'Manager'));

-- 5. VENDORS: Allow Viewer & Manager to view vendors
drop policy if exists "finance read vendors" on vendors;
create policy "finance read vendors" on vendors for select 
using (company_id = my_company() and my_role() in ('Owner', 'Accountant', 'Manager', 'Viewer'));

-- 6. CUSTOMERS: Allow Viewer to view customers
drop policy if exists "sales-facing read customers" on customers;
create policy "sales-facing read customers" on customers for select 
using (company_id = my_company() and my_role() in ('Owner', 'Accountant', 'Sales', 'Manager', 'Viewer'));

-- 7. AUDIT LOG & LOGIN ACTIVITY: Allow Manager & Viewer to read live audit logs
drop policy if exists "owner reads audit log" on audit_log;
drop policy if exists "read audit log" on audit_log;
create policy "read audit log" on audit_log for select 
using (company_id = my_company() and my_role() in ('Owner', 'Manager', 'Accountant', 'Viewer'));
