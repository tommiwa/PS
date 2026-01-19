-- ============================================================
-- BCI ParkShare Production Data Cleanup Script (Simple Version)
-- ============================================================
-- PURPOSE: Remove transactional data while preserving:
--   - Users (admin-created)
--   - Parking Spots (admin-created)  
--   - Reference data (departments, locations, spot types, etc.)
--
-- WARNING: This script DELETES DATA. Run with caution!
-- Always backup your database before running this script.
--
-- TO RUN: Copy and paste into your database client (e.g., Replit Database pane)
-- ============================================================

-- Delete in order to respect foreign key constraints

-- 1. Delete disputes (references bookings)
DELETE FROM disputes;

-- 2. Delete bookings
DELETE FROM bookings;

-- 3. Delete spot locks
DELETE FROM spot_locks;

-- 4. Delete spot listings
DELETE FROM spot_listings;

-- 5. Delete vehicles
DELETE FROM vehicles;

-- 6. Delete payment preferences
DELETE FROM payment_preferences;

-- 7. Delete waiting list
DELETE FROM waiting_list;

-- 8. Delete in-app notifications
DELETE FROM in_app_notifications;

-- 9. Delete notification preferences  
DELETE FROM notification_preferences;

-- 10. Delete spot assignment history
DELETE FROM spot_assignment_history;

-- 11. Delete audit logs
DELETE FROM audit_logs;

-- 12. Delete reported issues
DELETE FROM issues;

-- 13. Delete locker assignment history
DELETE FROM locker_assignment_history;

-- 14. Delete locker waitlist
DELETE FROM locker_waitlist;

-- 15. Clear locker assignments (keep locker records)
UPDATE lockers SET user_id = NULL, assigned_at = NULL;

-- 16. Delete sessions
DELETE FROM sessions;

-- ============================================================
-- PRESERVED DATA:
-- - users, parking_spots, departments, locations
-- - spot_types, locker_types, lockers, terms_versions, app_configs
-- ============================================================

-- Verify cleanup
SELECT 'Cleanup Summary' AS info;
SELECT 
  (SELECT COUNT(*) FROM users) AS users_kept,
  (SELECT COUNT(*) FROM parking_spots) AS spots_kept,
  (SELECT COUNT(*) FROM bookings) AS bookings_deleted,
  (SELECT COUNT(*) FROM spot_listings) AS listings_deleted;
