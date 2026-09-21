import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { pool } from './db';
import { migrations } from './migrations';

// Regression coverage for task #378's one-time data-fix migration
// ("reclassify_orphaned_unowned_spots_as_bci_managed"): a spot whose owner was cleared by a real
// release/unassign action (evidenced by a spot_assignment_history row) must be reclassified as
// BCI-managed pool inventory, while a spot that is legitimately unowned because it was created as
// Personal with no owner yet assigned (no assignment history at all) must be left alone.
//
// This runs against the real database connection (like other integration-style tests in this
// suite) rather than mocking storage, because the behavior under test IS the raw SQL in
// migrations.ts, not application code that wraps it.

const migration = migrations.find(m => m.name === 'reclassify_orphaned_unowned_spots_as_bci_managed');

const RELEASED_SPOT_ID = 'test-378-migration-released';
const NEVER_ASSIGNED_SPOT_ID = 'test-378-migration-never-assigned';

async function cleanup() {
  await pool.query(
    `DELETE FROM spot_assignment_history WHERE spot_id IN ($1, $2)`,
    [RELEASED_SPOT_ID, NEVER_ASSIGNED_SPOT_ID]
  );
  await pool.query(
    `DELETE FROM parking_spots WHERE id IN ($1, $2)`,
    [RELEASED_SPOT_ID, NEVER_ASSIGNED_SPOT_ID]
  );
}

async function getRefIds() {
  const refs = await pool.query(
    `SELECT (SELECT id FROM users LIMIT 1) AS user_id,
            (SELECT location_id FROM parking_spots LIMIT 1) AS location_id,
            (SELECT spot_type_id FROM parking_spots LIMIT 1) AS spot_type_id`
  );
  return refs.rows[0] as { user_id: string; location_id: number; spot_type_id: number };
}

describe('migration: reclassify_orphaned_unowned_spots_as_bci_managed (task #378)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('is registered', () => {
    expect(migration).toBeDefined();
  });

  it('reclassifies a spot with unassigned/released history but leaves a never-assigned spot alone', async () => {
    const { user_id: userId, location_id: locationId, spot_type_id: spotTypeId } = await getRefIds();

    // Spot that was actually released: owner cleared, not yet flagged BCI-managed, with a matching
    // spot_assignment_history row - the exact broken state a pre-fix release/unassign left behind.
    await pool.query(
      `INSERT INTO parking_spots (id, spot_number, location_id, spot_type_id, owner_id, is_bci_managed, is_active, is_bookable)
       VALUES ($1, 'TEST-378-REL', $2, $3, NULL, false, true, true)`,
      [RELEASED_SPOT_ID, locationId, spotTypeId]
    );
    await pool.query(
      `INSERT INTO spot_assignment_history (id, spot_id, user_id, action, effective_at)
       VALUES (gen_random_uuid(), $1, $2, 'unassigned', NOW())`,
      [RELEASED_SPOT_ID, userId]
    );

    // Spot that was legitimately created as Personal with no owner assigned yet - no assignment
    // history at all. Must NOT be swept into the BCI-managed pool.
    await pool.query(
      `INSERT INTO parking_spots (id, spot_number, location_id, spot_type_id, owner_id, is_bci_managed, is_active, is_bookable)
       VALUES ($1, 'TEST-378-NEW', $2, $3, NULL, false, true, true)`,
      [NEVER_ASSIGNED_SPOT_ID, locationId, spotTypeId]
    );

    // checkQuery must report the migration as needed (not already satisfied) while the released
    // spot's stale flag is still in place.
    const before = await pool.query(migration!.checkQuery);
    expect(before.rows[0].exists).toBe(false);

    for (const statement of migration!.migrationStatements) {
      await pool.query(statement);
    }

    const after = await pool.query(
      `SELECT id, is_bci_managed FROM parking_spots WHERE id IN ($1, $2)`,
      [RELEASED_SPOT_ID, NEVER_ASSIGNED_SPOT_ID]
    );
    const byId = Object.fromEntries(after.rows.map(r => [r.id, r.is_bci_managed]));
    expect(byId[RELEASED_SPOT_ID]).toBe(true);
    expect(byId[NEVER_ASSIGNED_SPOT_ID]).toBe(false);

    // Re-running is a no-op: checkQuery now reports satisfied.
    const idempotent = await pool.query(migration!.checkQuery);
    expect(idempotent.rows[0].exists).toBe(true);
  });
});
