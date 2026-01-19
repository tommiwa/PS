-- ============================================================
-- BCI ParkShare Production Data Cleanup Script
-- ============================================================
-- PURPOSE: Remove transactional data while preserving:
--   - Users (admin-created)
--   - Parking Spots (admin-created)
--   - Reference data (departments, locations, spot types, etc.)
--
-- WARNING: This script DELETES DATA. Run with caution!
-- Always backup your database before running this script.
-- ============================================================

-- Disable foreign key checks temporarily for faster deletion
-- (PostgreSQL handles this via CASCADE or proper order)

BEGIN;

-- ============================================================
-- STEP 1: Delete transactional/booking data
-- ============================================================

-- Delete disputes (references bookings)
DELETE FROM disputes;
RAISE NOTICE 'Deleted all disputes';

-- Delete bookings
DELETE FROM bookings;
RAISE NOTICE 'Deleted all bookings';

-- Delete spot locks (temporary booking locks)
DELETE FROM spot_locks;
RAISE NOTICE 'Deleted all spot locks';

-- Delete spot listings (owner availability listings)
DELETE FROM spot_listings;
RAISE NOTICE 'Deleted all spot listings';

-- ============================================================
-- STEP 2: Delete user-related transactional data
-- ============================================================

-- Delete vehicles registered by users
DELETE FROM vehicles;
RAISE NOTICE 'Deleted all vehicles';

-- Delete payment preferences
DELETE FROM payment_preferences;
RAISE NOTICE 'Deleted all payment preferences';

-- Delete waiting list entries
DELETE FROM waiting_list;
RAISE NOTICE 'Deleted all waiting list entries';

-- ============================================================
-- STEP 3: Delete notification data
-- ============================================================

-- Delete in-app notifications
DELETE FROM in_app_notifications;
RAISE NOTICE 'Deleted all in-app notifications';

-- Delete notification preferences
DELETE FROM notification_preferences;
RAISE NOTICE 'Deleted all notification preferences';

-- ============================================================
-- STEP 4: Delete history/audit data
-- ============================================================

-- Delete spot assignment history
DELETE FROM spot_assignment_history;
RAISE NOTICE 'Deleted all spot assignment history';

-- Delete audit logs
DELETE FROM audit_logs;
RAISE NOTICE 'Deleted all audit logs';

-- Delete reported issues
DELETE FROM issues;
RAISE NOTICE 'Deleted all reported issues';

-- ============================================================
-- STEP 5: Delete locker-related transactional data
-- ============================================================

-- Delete locker assignment history
DELETE FROM locker_assignment_history;
RAISE NOTICE 'Deleted all locker assignment history';

-- Delete locker waitlist
DELETE FROM locker_waitlist;
RAISE NOTICE 'Deleted all locker waitlist entries';

-- Unassign lockers (keep locker records but remove user assignments)
UPDATE lockers SET user_id = NULL, assigned_at = NULL;
RAISE NOTICE 'Cleared locker assignments';

-- ============================================================
-- STEP 6: Delete session data
-- ============================================================

-- Delete user sessions
DELETE FROM sessions;
RAISE NOTICE 'Deleted all sessions';

-- ============================================================
-- STEP 7: Reset user login data (optional - uncomment if needed)
-- ============================================================

-- Reset last login timestamps (optional)
-- UPDATE users SET last_login = NULL;

-- Reset terms acceptance (optional - forces re-acceptance)
-- UPDATE users SET terms_accepted_at = NULL, terms_version_accepted = NULL;

-- ============================================================
-- DATA PRESERVED (NOT DELETED):
-- ============================================================
-- - users: All user accounts preserved
-- - parking_spots: All parking spot records preserved
-- - departments: Department reference data
-- - locations: Location reference data
-- - spot_types: Spot type reference data
-- - locker_types: Locker type reference data
-- - lockers: Locker records preserved (assignments cleared)
-- - terms_versions: Terms and conditions versions
-- - app_configs: Application configuration settings
-- ============================================================

COMMIT;

-- Summary
SELECT 'Cleanup completed successfully!' AS status;
SELECT 
  (SELECT COUNT(*) FROM users) AS users_remaining,
  (SELECT COUNT(*) FROM parking_spots) AS spots_remaining,
  (SELECT COUNT(*) FROM bookings) AS bookings_remaining,
  (SELECT COUNT(*) FROM spot_listings) AS listings_remaining;
