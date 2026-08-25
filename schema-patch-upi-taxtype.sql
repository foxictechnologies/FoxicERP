-- =========================================================================
-- PATCH: UPI QR code + manual GST tax-type override
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to run even if you already ran the original schema or the
-- attachments patch.
-- =========================================================================

alter table companies add column if not exists upi_id text;
alter table invoices add column if not exists tax_type text default 'auto';
