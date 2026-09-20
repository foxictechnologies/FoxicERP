-- =========================================================================
-- PATCH: Vendor bank IFSC column
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> Run
-- Adds bank_ifsc to vendors so purchase bills can show full payment details.
-- =========================================================================

alter table vendors add column if not exists bank_ifsc text;
