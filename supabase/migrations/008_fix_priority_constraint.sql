-- Expand priority check to include all Zoho priority variants
ALTER TABLE synced_contacts DROP CONSTRAINT IF EXISTS synced_contacts_priority_check;
ALTER TABLE synced_contacts ADD CONSTRAINT synced_contacts_priority_check
  CHECK (priority IN ('High Priority', 'Medium Priority', 'Low Priority', 'Warm Priority', 'Hot Priority'));
