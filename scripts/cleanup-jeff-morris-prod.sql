-- ============================================================
-- ONE-OFF PRODUCTION CLEANUP: Cancel Jeff Morris's listings
-- Run this in the Neon database console (console.neon.tech)
-- ============================================================

-- STEP 1: Verify who we're targeting (run this first)
SELECT id, first_name, last_name, email
FROM users
WHERE LOWER(email) = 'jeff.morris@bci.ca'
   OR (LOWER(first_name) = 'jeff' AND LOWER(last_name) = 'morris');

-- STEP 2: Preview all listings for this user (run before making changes)
SELECT
  sl.id,
  sl.status,
  sl.listing_type,
  sl.single_date,
  sl.daily_rate,
  ps.spot_number
FROM spot_listings sl
LEFT JOIN parking_spots ps ON sl.spot_id = ps.id
WHERE sl.owner_id = (
  SELECT id FROM users
  WHERE LOWER(email) = 'jeff.morris@bci.ca'
     OR (LOWER(first_name) = 'jeff' AND LOWER(last_name) = 'morris')
  LIMIT 1
)
ORDER BY sl.single_date;

-- STEP 3: Preview any active bookings that would also need cancelling
SELECT b.id, b.status, b.booking_date, b.total_amount
FROM bookings b
WHERE b.listing_id IN (
  SELECT sl.id FROM spot_listings sl
  WHERE sl.owner_id = (
    SELECT id FROM users
    WHERE LOWER(email) = 'jeff.morris@bci.ca'
       OR (LOWER(first_name) = 'jeff' AND LOWER(last_name) = 'morris')
    LIMIT 1
  )
  AND sl.status = 'available'
)
AND b.status IN ('pending', 'confirmed', 'upcoming', 'active');

-- ============================================================
-- STEP 4: EXECUTE THE CLEANUP (only run after reviewing above)
-- ============================================================

-- Cancel active bookings first
UPDATE bookings
SET status = 'cancelled',
    cancellation_reason = 'Listing cancelled by admin (bulk cleanup)',
    updated_at = NOW()
WHERE listing_id IN (
  SELECT sl.id FROM spot_listings sl
  WHERE sl.owner_id = (
    SELECT id FROM users
    WHERE LOWER(email) = 'jeff.morris@bci.ca'
       OR (LOWER(first_name) = 'jeff' AND LOWER(last_name) = 'morris')
    LIMIT 1
  )
  AND sl.status = 'available'
)
AND status IN ('pending', 'confirmed', 'upcoming', 'active');

-- Cancel the listings
UPDATE spot_listings
SET status = 'cancelled',
    updated_at = NOW()
WHERE owner_id = (
  SELECT id FROM users
  WHERE LOWER(email) = 'jeff.morris@bci.ca'
     OR (LOWER(first_name) = 'jeff' AND LOWER(last_name) = 'morris')
  LIMIT 1
)
AND status = 'available';

-- STEP 5: Confirm cleanup completed
SELECT status, COUNT(*) as count
FROM spot_listings
WHERE owner_id = (
  SELECT id FROM users
  WHERE LOWER(email) = 'jeff.morris@bci.ca'
     OR (LOWER(first_name) = 'jeff' AND LOWER(last_name) = 'morris')
  LIMIT 1
)
GROUP BY status;
