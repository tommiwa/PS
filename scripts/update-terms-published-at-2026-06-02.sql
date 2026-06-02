-- Update the active Terms & Conditions published_at date to June 2, 2026
-- This sets the "Last updated" date displayed on the T&C consent and view pages.
UPDATE terms_versions
SET published_at = '2026-06-02 00:00:00',
    updated_at   = '2026-06-02 00:00:00'
WHERE is_active = true;
