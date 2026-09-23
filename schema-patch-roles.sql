-- =========================================================================
-- SCHEMA PATCH: MANAGER & VIEWER ROLES FIX (FIXES ERROR 23514)
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Fixes ERROR 23514 by normalizing existing profile roles (e.g. 'Operations Manager')
-- and expanding the check constraint to support both short keys and full labels.
-- =========================================================================

-- 1. Normalize existing profile rows that contain full display labels instead of short keys
update profiles set role = 'Manager' where role in ('Operations Manager', 'manager');
update profiles set role = 'Owner' where role in ('Business Owner', 'owner');
update profiles set role = 'Sales' where role in ('Sales Employee', 'sales');
update profiles set role = 'Inventory' where role in ('Inventory Manager', 'inventory');
update profiles set role = 'Viewer' where role in ('Viewer (Read Only)', 'viewer');
update profiles set role = 'Accountant' where role in ('accountant');

-- 2. Drop existing check constraint on profiles.role
alter table if exists profiles 
  drop constraint if exists profiles_role_check;

-- 3. Add updated check constraint supporting both short keys and full labels
alter table if exists profiles 
  add constraint profiles_role_check 
  check (role in (
    'Owner', 'Business Owner',
    'Accountant',
    'Sales', 'Sales Employee',
    'Inventory', 'Inventory Manager',
    'Manager', 'Operations Manager',
    'Viewer', 'Viewer (Read Only)'
  ));
