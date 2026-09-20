-- =========================================================================
-- INDIA BUSINESS ERP — FULL DEPLOYMENT SCHEMA
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
--
-- This is the complete, consolidated schema — includes the base tables,
-- attachments (proof-of-billing/payment files), the UPI QR code field,
-- the manual GST tax-type override, Row-Level Security for every table,
-- private Storage bucket for attachments, and performance indexes.
--
-- Fresh install: this is the ONLY schema file you need to run.
-- Existing database: if you already ran an earlier version of this file,
-- you do NOT need to re-run it — the separate schema-patch-*.sql files
-- cover exactly the columns/bucket added since your last run, and are
-- safe to run again (they use `if not exists` / `on conflict do nothing`).
-- =========================================================================

-- 1. PROFILES (extends Supabase's built-in auth.users with role + company)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null,
  name text not null,
  role text not null check (role in ('Owner','Accountant','Sales','Inventory','Manager','Viewer')),
  status text not null default 'Active' check (status in ('Active','Deactivated')),
  created_at timestamptz default now()
);

-- 2. COMPANY SETTINGS
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text, legal_name text, owner_name text, address text, city text,
  state text, pin text, phone text, email text, gstin text, pan text,
  bank_name text, bank_account text, bank_ifsc text, upi_id text,
  invoice_prefix text default 'INV/', next_invoice_number int default 1,
  purchase_prefix text default 'PO/', next_purchase_number int default 1,
  financial_year text, default_gst_rate int default 18,
  payment_terms text, terms_and_conditions text,
  created_at timestamptz default now()
);

-- 3. CORE BUSINESS TABLES
create table products (
  id uuid primary key default gen_random_uuid(), company_id uuid not null,
  name text not null, sku text, hsn text, category text, unit text default 'PCS',
  purchase_price numeric default 0, selling_price numeric default 0, mrp numeric default 0,
  gst_rate int default 18, current_stock numeric default 0, reorder_level numeric default 0,
  created_at timestamptz default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(), company_id uuid not null,
  name text not null, contact text, phone text, email text, gstin text,
  state text, address text, pin text, credit_limit numeric default 0,
  payment_terms text, created_at timestamptz default now()
);

create table vendors (
  id uuid primary key default gen_random_uuid(), company_id uuid not null,
  name text not null, contact text, phone text, email text, gstin text,
  state text, address text, bank_name text, bank_account text, bank_ifsc text,
  payment_terms text, created_at timestamptz default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(), company_id uuid not null,
  number text not null, date date not null, due_date date, customer_id uuid references customers(id),
  status text default 'Draft', items jsonb not null, paid_amount numeric default 0,
  attachment_url text, tax_type text default 'auto',
  created_by uuid references profiles(id), created_at timestamptz default now()
);

create table purchases (
  id uuid primary key default gen_random_uuid(), company_id uuid not null,
  number text not null, date date not null, vendor_id uuid references vendors(id),
  status text default 'Pending', items jsonb not null,
  attachment_url text,
  created_by uuid references profiles(id), created_at timestamptz default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(), company_id uuid not null,
  date date not null, type text, party_id uuid, ref_id uuid, ref_number text,
  amount numeric not null, method text, notes text,
  attachment_url text,
  created_by uuid references profiles(id), created_at timestamptz default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(), company_id uuid not null,
  date date not null, category text, amount numeric not null, vendor text,
  method text, description text, attachment_url text, created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table stock_ledger (
  id uuid primary key default gen_random_uuid(), company_id uuid not null,
  product_id uuid references products(id), date date not null,
  type text, qty numeric not null, ref_id uuid, created_at timestamptz default now()
);

-- 4. AUDIT LOG — every important action, visible to Owner only
create table audit_log (
  id uuid primary key default gen_random_uuid(), company_id uuid not null,
  user_id uuid references profiles(id), user_name text, role text,
  action text not null, details text, timestamp timestamptz default now()
);

-- =========================================================================
-- HELPER FUNCTIONS — read the caller's role/company without recursive RLS
-- =========================================================================
create or replace function my_role() returns text as $$
  select role from profiles where id = auth.uid() and status = 'Active';
$$ language sql stable security definer set search_path = public;

create or replace function my_company() returns uuid as $$
  select company_id from profiles where id = auth.uid() and status = 'Active';
$$ language sql stable security definer set search_path = public;

-- Audit rows are stamped server-side from the caller's own profile, so a
-- client cannot forge entries claiming to be another user or role.
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

-- Atomic stock adjustment: updates current_stock and writes the ledger row
-- in one transaction, so concurrent saves can never overwrite each other.
-- Runs security definer because Sales/Accountant users legitimately move
-- stock (invoices/purchases) but can't update products directly under RLS;
-- the guard below restricts it to Active members of the product's company.
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

-- =========================================================================
-- ENABLE ROW LEVEL SECURITY — this is what makes role restrictions REAL,
-- enforced by Postgres itself, not just hidden in the UI.
-- =========================================================================
alter table profiles enable row level security;
alter table companies enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table vendors enable row level security;
alter table invoices enable row level security;
alter table purchases enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table stock_ledger enable row level security;
alter table audit_log enable row level security;

-- PROFILES: everyone in the company can see the team list; only Owner edits
create policy "view team" on profiles for select using (company_id = my_company());
create policy "owner manages team" on profiles for all using (my_role() = 'Owner' and company_id = my_company());

-- COMPANY: everyone can read settings; only Owner edits
create policy "read company" on companies for select using (id = my_company());
create policy "owner edits company" on companies for update using (my_role() = 'Owner' and id = my_company());

-- PRODUCTS: everyone in the company can read (needed to build invoices);
-- only Owner and Inventory can write
create policy "read products" on products for select using (company_id = my_company());
create policy "owner/inventory write products" on products for insert with check (my_role() in ('Owner','Inventory') and company_id = my_company());
create policy "owner/inventory update products" on products for update using (my_role() in ('Owner','Inventory') and company_id = my_company());
create policy "owner/inventory delete products" on products for delete using (my_role() in ('Owner','Inventory') and company_id = my_company());

-- CUSTOMERS: Owner, Accountant, Sales can read/write; Inventory cannot
create policy "sales-facing read customers" on customers for select using (company_id = my_company() and my_role() in ('Owner','Accountant','Sales'));
create policy "sales-facing write customers" on customers for insert with check (company_id = my_company() and my_role() in ('Owner','Accountant','Sales'));
create policy "sales-facing update customers" on customers for update using (company_id = my_company() and my_role() in ('Owner','Accountant','Sales'));
create policy "sales-facing delete customers" on customers for delete using (company_id = my_company() and my_role() in ('Owner','Accountant','Sales'));

-- VENDORS: Owner and Accountant only
create policy "finance read vendors" on vendors for select using (company_id = my_company() and my_role() in ('Owner','Accountant'));
create policy "finance write vendors" on vendors for all using (company_id = my_company() and my_role() in ('Owner','Accountant'));

-- INVOICES: Owner/Accountant see everything; Sales sees invoices only (no cost/profit fields exist here anyway)
create policy "read invoices" on invoices for select using (company_id = my_company() and my_role() in ('Owner','Accountant','Sales'));
create policy "write invoices" on invoices for insert with check (company_id = my_company() and my_role() in ('Owner','Accountant','Sales'));
create policy "update invoices" on invoices for update using (company_id = my_company() and my_role() in ('Owner','Accountant','Sales'));

-- PURCHASES / EXPENSES / PAYMENTS: Owner and Accountant only — this is the
-- server-side enforcement of "Sales/Inventory never see purchasing or P&L data"
create policy "finance read purchases" on purchases for select using (company_id = my_company() and my_role() in ('Owner','Accountant'));
create policy "finance write purchases" on purchases for all using (company_id = my_company() and my_role() in ('Owner','Accountant'));

create policy "finance read expenses" on expenses for select using (company_id = my_company() and my_role() in ('Owner','Accountant'));
create policy "finance write expenses" on expenses for all using (company_id = my_company() and my_role() in ('Owner','Accountant'));

create policy "finance read payments" on payments for select using (company_id = my_company() and my_role() in ('Owner','Accountant'));
create policy "finance write payments" on payments for all using (company_id = my_company() and my_role() in ('Owner','Accountant'));

-- STOCK LEDGER: Owner and Inventory only
create policy "inventory read ledger" on stock_ledger for select using (company_id = my_company() and my_role() in ('Owner','Inventory'));
create policy "inventory write ledger" on stock_ledger for insert with check (company_id = my_company() and my_role() in ('Owner','Inventory'));

-- AUDIT LOG: anyone can insert (so their own actions get logged); only Owner can read
create policy "anyone logs actions" on audit_log for insert with check (company_id = my_company());
create policy "owner reads audit log" on audit_log for select using (my_role() = 'Owner' and company_id = my_company());

drop trigger if exists trg_audit_context on audit_log;
create trigger trg_audit_context before insert on audit_log
  for each row execute function set_audit_context();

-- =========================================================================
-- STORAGE — private bucket for proof-of-billing/payment attachments (PDF/image)
-- =========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy "company members upload attachments" on storage.objects
  for insert with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = my_company()::text);
create policy "company members read attachments" on storage.objects
  for select using (bucket_id = 'attachments' and (storage.foldername(name))[1] = my_company()::text);
create policy "company members delete attachments" on storage.objects
  for delete using (bucket_id = 'attachments' and (storage.foldername(name))[1] = my_company()::text);

-- =========================================================================
-- INDEXES — every table is filtered by company_id on nearly every query
-- (that's what Row-Level Security does under the hood), so these matter
-- for performance once you have more than a few hundred rows.
-- =========================================================================
create index if not exists idx_profiles_company on profiles(company_id);
create index if not exists idx_products_company on products(company_id);
create index if not exists idx_customers_company on customers(company_id);
create index if not exists idx_vendors_company on vendors(company_id);
create index if not exists idx_invoices_company on invoices(company_id);
create index if not exists idx_invoices_customer on invoices(customer_id);
create index if not exists idx_purchases_company on purchases(company_id);
create index if not exists idx_purchases_vendor on purchases(vendor_id);
create index if not exists idx_payments_company on payments(company_id);
create index if not exists idx_payments_ref on payments(ref_id);
create index if not exists idx_expenses_company on expenses(company_id);
create index if not exists idx_stock_ledger_company on stock_ledger(company_id);
create index if not exists idx_stock_ledger_product on stock_ledger(product_id);
create index if not exists idx_audit_log_company on audit_log(company_id);
create index if not exists idx_audit_log_timestamp on audit_log(timestamp desc);

-- Invoice/purchase numbers must be unique within a company — prevents
-- duplicate numbers when two users save at the same moment.
create unique index if not exists idx_invoices_company_number on invoices(company_id, number);
create unique index if not exists idx_purchases_company_number on purchases(company_id, number);

-- =========================================================================
-- NEXT STEPS (see DEPLOYMENT_GUIDE.md)
-- 1. Create a free Supabase project, run this file in its SQL editor.
-- 2. Create your first Owner user via Supabase Auth, then insert a matching
--    row into `profiles` and `companies` with your details.
-- 3. Connect your React app using the Supabase client (guide included).
-- =========================================================================
