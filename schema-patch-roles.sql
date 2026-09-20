-- =========================================================================
-- SCHEMA PATCH: MANAGER & VIEWER ROLES
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Adds support for 'Manager' and 'Viewer' roles in the profiles table.
-- =========================================================================

-- 1. Drop existing check constraint on profiles.role if it exists
alter table if exists profiles 
  drop constraint if exists profiles_role_check;

-- 2. Add updated check constraint with Owner, Accountant, Sales, Inventory, Manager, Viewer
alter table if exists profiles 
  add constraint profiles_role_check 
  check (role in ('Owner', 'Accountant', 'Sales', 'Inventory', 'Manager', 'Viewer'));
