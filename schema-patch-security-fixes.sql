-- =========================================================================
-- PATCH: Security & integrity fixes
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to run on any database that already has the main schema applied.
-- Fixes:
--   1. my_company() now requires the caller's profile to be Active, so a
--      Deactivated user loses storage/audit access immediately.
--   2. security definer functions pin search_path (Supabase lint fix).
--   3. audit_log rows are stamped server-side — users cannot forge
--      entries as another user or role.
--   4. DELETE policy added for customers (was missing — deletes failed).
--   5. Unique index on invoice/purchase numbers per company.
-- If step 5 fails with "could not create unique index", you have duplicate
-- numbers in existing rows — dedupe them first, then re-run.
-- =========================================================================

create or replace function my_role() returns text as $$
  select role from profiles where id = auth.uid() and status = 'Active';
$$ language sql stable security definer set search_path = public;

create or replace function my_company() returns uuid as $$
  select company_id from profiles where id = auth.uid() and status = 'Active';
$$ language sql stable security definer set search_path = public;

create or replace function set_audit_context() returns trigger as $$
declare p record;
begin
  select name, role into p from profiles where id = auth.uid();
  new.user_id := auth.uid();
  new.user_name := coalesce(p.name, 'Unknown');
  new.role := coalesce(p.role, 'Unknown');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_audit_context on audit_log;
create trigger trg_audit_context before insert on audit_log
  for each row execute function set_audit_context();

drop policy if exists "sales-facing delete customers" on customers;
create policy "sales-facing delete customers" on customers
  for delete using (company_id = my_company() and my_role() in ('Owner','Accountant','Sales'));

-- Atomic stock adjustment: updates current_stock and writes the ledger row
-- in one transaction, so concurrent saves can never overwrite each other.
-- Runs security definer so Sales/Accountant users can move stock through
-- invoices/purchases; guarded to Active members of the product's company.
create or replace function adjust_stock(p_product_id uuid, p_delta numeric, p_type text, p_ref_id uuid)
returns void as $$
declare v_company uuid;
begin
  select company_id into v_company from products where id = p_product_id;
  if v_company is null or not exists (
    select 1 from profiles
    where id = auth.uid() and status = 'Active' and company_id = v_company
  ) then
    raise exception 'adjust_stock: caller is not an Active member of this product''s company';
  end if;
  update products set current_stock = current_stock + p_delta where id = p_product_id;
  insert into stock_ledger (id, company_id, product_id, date, type, qty, ref_id)
  values (gen_random_uuid(), v_company, p_product_id, current_date, p_type, p_delta, p_ref_id);
end;
$$ language plpgsql security definer set search_path = public;

create unique index if not exists idx_invoices_company_number on invoices(company_id, number);
create unique index if not exists idx_purchases_company_number on purchases(company_id, number);
