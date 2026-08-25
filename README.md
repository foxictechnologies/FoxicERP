# India Business ERP — Supabase-connected

Real authentication, a real Postgres database, and role-based security enforced
at the database level (Row-Level Security) — not just hidden in the UI.

## Project structure

The codebase was restructured from one large file into one file per page/
concern, so you can find and change things without hunting through 1,800
lines of code. Every file has a comment block at the top explaining what it
does and how it connects to the rest of the app.

```
src/
├── App.jsx                    the shell: login gate, data loading, sidebar/
│                               header layout, and which page is shown
├── main.jsx                   React entry point (rarely needs changes)
├── supabaseClient.js          Supabase connection setup
├── sampleData.js               the "Load sample data" demo dataset
│
├── lib/                        pure logic, no UI — safe to read in isolation
│   ├── constants.js            colors (T), dropdown lists, ROLES, NAV (the
│   │                           sidebar menu) — edit this to add a new tab
│   │                           or change a dropdown's options
│   ├── format.js                INR formatting, date helpers, uid()
│   ├── dateRange.js             the date-range dropdown -> {start,end} logic
│   ├── taxEngine.js             GST calculation — the ONE place invoice tax
│   │                           math happens (CGST/SGST/IGST, auto vs manual)
│   └── db.js                    every Supabase database call + file uploads
│
├── components/                  shared UI building blocks used by many pages
│   ├── ui.jsx                   Card, Button, Modal, Input, Badge, etc. —
│   │                           edit this to restyle the whole app at once
│   ├── FileInput.jsx            the attachment/proof-of-billing file picker
│   ├── AttachmentLink.jsx       "View proof" link that opens an attachment
│   ├── UpiQr.jsx                 the scan-to-pay QR code on invoices
│   ├── GlobalSearch.jsx          the header search box
│   └── NotificationsBell.jsx     the header notifications dropdown
│
├── auth/                        everything about signing in
│   ├── LoginScreen.jsx
│   ├── ChangePasswordModal.jsx
│   └── NoProfileScreen.jsx      shown if someone logs in but has no role yet
│
└── pages/                       one file per sidebar tab — THIS is where
    │                           you'll spend most of your time making changes
    ├── Dashboard.jsx
    ├── AnalyticsModule.jsx      "Date-wise Analytics" tab
    ├── SalesModule.jsx          "Sales & Invoices" list + save/cancel logic
    ├── InvoiceForm.jsx          the New/Edit Invoice modal
    ├── InvoiceView.jsx          the read-only/printable invoice
    ├── PurchasesModule.jsx
    ├── InventoryModule.jsx
    ├── PartyModule.jsx          powers BOTH Customers and Vendors tabs
    ├── PartyStatement.jsx       the customer/vendor account statement modal
    ├── PaymentsModule.jsx
    ├── ExpensesModule.jsx
    ├── ReportsModule.jsx
    ├── SettingsModule.jsx
    └── UsersAuditModule.jsx     "Users & Access Log" (Owner only)
```

### How to make a common change

- **"I want to change how something looks everywhere"** (colors, button
  style, card spacing) → edit `lib/constants.js` (colors) or
  `components/ui.jsx` (the components themselves).
- **"I want to change one specific screen"** (e.g. the invoice form) → go
  straight to that file in `pages/`. Each page only imports what it needs,
  so you can read one file top-to-bottom without jumping around.
- **"I want to add a new field to a form"** → find the `<Field>` block for
  a similar field in the relevant `pages/*.jsx` file, copy the pattern.
  If it needs to be saved to the database, also add the field name to the
  matching table's list in `lib/db.js` (`TABLE_COLUMNS`) and add the column
  in Supabase (Table Editor, or a small `alter table ... add column` in the
  SQL Editor).
- **"I want to add a whole new page/tab"** → see the numbered steps at the
  top of `App.jsx`.
- **"I want to change GST/tax logic"** → everything runs through the single
  `computeInvoiceTotals()` function in `lib/taxEngine.js`.

## Latest changes

- **Fixed**: invoices for out-of-state customers always used IGST with no way
  to override. You can now force CGST+SGST or IGST per invoice ("GST
  calculation" dropdown), with a warning shown when you override the automatic
  detection, since the wrong choice affects your GST return.
- **Fixed**: quantity/discount fields showed a pre-filled `1`/`0`, so the
  placeholder text you asked for was never visible. They now start empty with
  visible placeholders; the rate still auto-fills from the product (that part
  was a helpful default, not a bug).
- **New**: due date is now optional — a checkbox controls whether one is set;
  invoices without a due date are treated as payable on receipt.
- **New**: UPI payment QR code on invoices — set your UPI ID in
  Settings → Bank details, and any invoice with a balance due shows a
  scan-to-pay QR code for the exact outstanding amount.
- **Security**: file uploads are now validated for type and size on both the
  client and the storage bucket itself (10MB limit, PDF/JPG/PNG/WEBP/HEIC
  only) — client-side checks alone can be bypassed, so this is enforced
  server-side too.
- **Security**: 20-minute idle auto sign-out, and a self-service "change
  password" option in the header (no more needing the Supabase dashboard for
  a routine password change).

**Migration**: if your database already exists, run
`schema-patch-upi-taxtype.sql` once (adds `upi_id` and `tax_type` columns).
If you already ran the attachments patch before, re-run
`schema-patch-attachments.sql` — it now also adds file-size/type limits to
the storage bucket. Fresh installs only need `supabase-schema.sql`.

## What's new in this version

- **Fixed**: the header search bar was previously just decorative text with no
  function — it's now a real search across products/customers/vendors/invoices
  (role-scoped), with results that jump you to the right module.
- **Fixed**: the Dashboard date-range dropdown changed state but never
  filtered anything — it now actually filters every KPI and chart.
- **New**: Date-wise Analytics tab — sales/purchases by day, with a date range
  picker (including custom ranges) and a chart.
- **New**: optional PDF/image attachments ("proof of billing/payment") on
  invoices, purchases, payments, and expenses, stored in a private Supabase
  Storage bucket.
- **New**: notifications bell (overdue invoices, low stock, recent payments),
  a customer/vendor account statement with running balance, and a date-wise
  stock movement chart in Inventory.
- **Improved**: every input field now has placeholder text showing what to enter.

**If you already ran the original `supabase-schema.sql`**, you need to also
run `schema-patch-attachments.sql` once in the Supabase SQL Editor to add the
attachment columns and storage bucket — otherwise file uploads will fail.
If you're setting up fresh, the attachment support is already included in
`supabase-schema.sql`, so you only need to run that one file.

## 1. Set up Supabase

1. Create a free project at supabase.com.
2. SQL Editor → run `supabase-schema.sql` (from the deployment guide) — or ask
   for it again if you don't have it.
3. Authentication → Providers → confirm Email is enabled.
4. Authentication → Users → Add user → create your own Owner login (email + password).
5. Table Editor → `companies` → insert one row with your business details. Copy its `id`.
6. Table Editor → `profiles` → insert one row: `id` = your auth user's id (from step 4),
   `company_id` = the id from step 5, `name` = your name, `role` = `Owner`, `status` = `Active`.
7. Project Settings → API → copy the Project URL and anon public key.

## 2. Run locally

```bash
cp .env.example .env    # fill in your Supabase URL + anon key
npm install
npm run dev
```

Open the local URL, sign in with the Owner email/password from step 1.4.

## 3. Add your team

Sign in as Owner → **Users & Access Log** → for each teammate:
1. Create their login in Supabase Dashboard → Authentication → Users → Add user.
2. Copy their User ID.
3. Back in the app, click **New User**, paste the ID, set their name and role.

Note: adding users requires the two-step process above because creating a
password-protected login from a public frontend safely requires a server-side
admin key — exposing that key in the browser would let anyone create accounts.
A future improvement would be a small Supabase Edge Function (server-side) to
make this fully self-service; not included here to keep the app safe by default.

## 4. Deploy for free

1. Push this folder to a new GitHub repository.
2. vercel.com → Add New Project → import the repo.
3. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. You'll get a live `your-app.vercel.app` URL.

## Additional security settings to enable (dashboard-only, 2 minutes)

Supabase Auth has a few protections that are toggles in the dashboard, not
code — worth turning on since you asked to harden the app:

1. **Authentication → Providers → Email** → enable "Leaked password protection".
2. **Authentication → Rate Limits** → confirm sign-in attempt limits are on (enabled by default).
3. **Authentication → Settings** → consider lowering the JWT expiry / session
   timeout to match your risk tolerance (default is usually fine for most small businesses).
4. Optional: **Authentication → Providers** supports enabling MFA (TOTP) for
   extra protection on the Owner account specifically — not wired into this
   app's UI, but available directly through Supabase if you want it later.

## What's real here vs. the earlier prototype

- Passwords: hashed by Supabase Auth, never touch your own code.
- Role restrictions: enforced by Postgres Row-Level Security policies — even a
  modified frontend can't get a Sales login to read purchase/expense data.
- Data: lives in your own Postgres database, not the browser.
- Audit log: every login and business-record change is written to the
  `audit_log` table and visible to the Owner only.

## What's still not included (by design, not oversight)

- **e-Invoice/IRN and e-Way Bill generation** — needs a licensed GSP integration.
- **Statutory payroll (PF/ESI/TDS)** — needs configured, validated Indian payroll rules.
- **Self-service team invites** — see the note in section 3 above.

## A note on testing

This code was written and reviewed for correctness but not run against a live
Supabase project from this environment (no network access here). Test the
core flows — sign in, create a product/customer, raise an invoice, record a
payment — right after your first deploy, and check the browser console for
any error messages if something doesn't behave as expected.
