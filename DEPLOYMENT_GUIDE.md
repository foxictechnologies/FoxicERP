# Taking your ERP live — free-tier deployment guide

This walks you from "artifact in a chat" to "real app your team logs into." Total cost: **₹0** on free tiers (until you outgrow them — see limits at the bottom).

---

## Step 1 — Create your database (Supabase, free)

1. Go to **supabase.com** → Sign up (free) → **New project**.
2. Pick a name, a strong database password (save it), and the region closest to you (e.g. Mumbai/Singapore).
3. Once the project is ready, open **SQL Editor → New query**, paste in the contents of `supabase-schema.sql` (provided), and click **Run**.
4. Go to **Authentication → Providers** and make sure **Email** is enabled. This gives you real hashed-password login — no more plain-text demo accounts.
5. Go to **Project Settings → API** and copy your **Project URL** and **anon public key**. You'll need these in Step 3.

## Step 2 — Create your first Owner login

1. **Authentication → Users → Add user** — enter your email and a password. This creates the real login account.
2. **Table Editor → companies** → insert one row with your business details (name, GSTIN, address, etc.). Copy the generated `id`.
3. **Table Editor → profiles** → insert one row: `id` = the user id from step 1, `company_id` = the id from step 2, `name` = your name, `role` = `Owner`, `status` = `Active`.

You can now sign in as Owner from the real app once it's deployed.

## Step 3 — Connect the app to Supabase

The artifact currently uses a browser-only `window.storage` and a plain-text password check — those only work inside Claude's interface. To run for real, the app needs to talk to Supabase instead. In outline, this means:

- Install the client: `npm install @supabase/supabase-js`
- Create `supabaseClient.js` with your Project URL + anon key from Step 1
- Replace the login form's manual password check with `supabase.auth.signInWithPassword({ email, password })`
- Replace every `window.storage.get/set` call with `supabase.from('table_name').select()/insert()/update()`

This is a real, non-trivial code migration (the current file is ~1800 lines). **I can do this conversion for you** — just say the word and I'll produce the Supabase-connected version of the app as the next step, ready to push to GitHub.

## Step 4 — Deploy the frontend (Vercel, free)

1. Push your project folder to a new **GitHub** repository (free).
2. Go to **vercel.com** → Sign up with GitHub → **Add New Project** → import your repo.
3. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
4. Click **Deploy**. You'll get a live URL like `your-erp.vercel.app` within a couple of minutes.
5. (Optional) **Vercel → Domains** → add your own domain (e.g. `erp.yourbusiness.in`) if you own one — free to connect, the domain itself costs money if you don't already have it.

## Step 5 — Add your real team

Once live, sign in as Owner → **Users & Access Log** → add each team member with their real email and a temporary password (they should change it on first login via Supabase's password reset flow).

---

## Free-tier limits to know about

| Service | Free tier | When you'd need to pay |
|---|---|---|
| Supabase | 500MB database, 50K monthly active users, project pauses after 1 week of inactivity | Realistically fine for a small business for a long time; ~$25/mo (~₹2,000) if you outgrow it |
| Vercel | 100GB bandwidth/month, unlimited free projects | Only relevant at real scale |
| Domain | Not included | ~₹700–1500/year if you want your own `.in`/`.com` instead of the free `.vercel.app` subdomain |

## What this setup gives you that the current artifact doesn't

- Real hashed-password authentication (not plain text)
- Role restrictions enforced **by the database itself** (Row-Level Security) — even if someone tampered with the frontend code, Postgres would still refuse to hand a Sales login any purchase/expense data
- Data that persists on your own infrastructure, accessible from any device, by your whole team
- A real audit trail your Owner account can trust
