-- Migration 020: make field_updates.contact_id nullable
-- Problem: contact_id was NOT NULL (migration 006), but company-only field edits never
-- set it, causing every company field update to silently fail to queue for CRM push.
-- Fix: drop the NOT NULL constraint and add a CHECK so at least one FK is always set.

ALTER TABLE field_updates
  ALTER COLUMN contact_id DROP NOT NULL;

ALTER TABLE field_updates
  ADD CONSTRAINT field_updates_has_target
    CHECK (contact_id IS NOT NULL OR company_id IS NOT NULL);
