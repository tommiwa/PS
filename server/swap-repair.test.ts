/**
 * Database-backed regression tests for the startup spot-swap repair
 * (server/swap-repair.ts). These run against the real development database:
 * fixtures use a unique "swtest-" prefix and are removed in afterAll.
 *
 * Scenarios:
 *  1. Pool -> owner transfer: pool-era damage reverse-repaired, in-tenure
 *     swap damage forward-repaired.
 *  2. A -> B transfer: prior owner A's rows are never touched.
 *  3. A -> B -> A re-transfer: A's legitimate first-tenure rows untouched.
 *  4. A -> released -> A: intervening pool period never forward-repaired,
 *     damaged gap rows restored, first-stint rows untouched.
 *  5. Idempotency: a second run changes nothing.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { runSwapRepair } from "./swap-repair";

const P = "swtest";
const noLog = () => {};

async function cleanup() {
  await db.execute(sql.raw(`
    DELETE FROM bookings WHERE id LIKE '${P}-bkg-%';
    DELETE FROM spot_listings WHERE id LIKE '${P}-lst-%';
    DELETE FROM spot_assignment_history WHERE id LIKE '${P}-hist-%';
    DELETE FROM parking_spots WHERE id LIKE '${P}-spot-%';
    DELETE FROM users WHERE id LIKE '${P}-user-%';
  `));
}

async function fetchState() {
  const listings = await db.execute(sql.raw(
    `SELECT id, owner_id, created_by_admin FROM spot_listings WHERE id LIKE '${P}-lst-%' ORDER BY id`));
  const bookings = await db.execute(sql.raw(
    `SELECT id, owner_id FROM bookings WHERE id LIKE '${P}-bkg-%' ORDER BY id`));
  const l = new Map((listings.rows as any[]).map(r => [r.id, r]));
  const b = new Map((bookings.rows as any[]).map(r => [r.id, r]));
  return { l, b };
}

beforeAll(async () => {
  await cleanup();
  await db.execute(sql.raw(`
    INSERT INTO users (id, email, first_name, last_name) VALUES
     ('${P}-user-a','${P}-a@test.local','A','Owner'),
     ('${P}-user-b','${P}-b@test.local','B','Owner'),
     ('${P}-user-adm','${P}-adm@test.local','Admin','X'),
     ('${P}-user-r','${P}-r@test.local','Renter','X');

    INSERT INTO parking_spots (id, spot_number, owner_id, is_bci_managed, location_id, spot_type_id)
    SELECT v.id, v.sn, v.owner, false, (SELECT id FROM locations LIMIT 1), (SELECT id FROM spot_types LIMIT 1)
    FROM (VALUES
      ('${P}-spot-pool','SWT1','${P}-user-a'),
      ('${P}-spot-ab',  'SWT2','${P}-user-b'),
      ('${P}-spot-aba', 'SWT3','${P}-user-a'),
      ('${P}-spot-rel', 'SWT4','${P}-user-a')
    ) v(id, sn, owner);

    INSERT INTO spot_assignment_history (id, spot_id, user_id, action, effective_at, actor_id) VALUES
     -- spot-pool: in the pool (prior user unassigned) until A assigned 2026-08-01
     ('${P}-hist-1','${P}-spot-pool','${P}-user-b','unassigned','2026-03-01','${P}-user-adm'),
     ('${P}-hist-2','${P}-spot-pool','${P}-user-a','assigned','2026-08-01','${P}-user-adm'),
     -- spot-ab: A owned it, then transferred directly to B (current owner)
     ('${P}-hist-3','${P}-spot-ab','${P}-user-a','assigned','2026-01-01','${P}-user-adm'),
     ('${P}-hist-4','${P}-spot-ab','${P}-user-a','unassigned','2026-05-01','${P}-user-adm'),
     ('${P}-hist-5','${P}-spot-ab','${P}-user-b','assigned','2026-05-01','${P}-user-adm'),
     -- spot-aba: A -> B -> A
     ('${P}-hist-6','${P}-spot-aba','${P}-user-a','assigned','2026-01-01','${P}-user-adm'),
     ('${P}-hist-7','${P}-spot-aba','${P}-user-a','unassigned','2026-04-01','${P}-user-adm'),
     ('${P}-hist-8','${P}-spot-aba','${P}-user-b','assigned','2026-04-01','${P}-user-adm'),
     ('${P}-hist-9','${P}-spot-aba','${P}-user-b','unassigned','2026-06-01','${P}-user-adm'),
     ('${P}-hist-10','${P}-spot-aba','${P}-user-a','assigned','2026-06-01','${P}-user-adm'),
     -- spot-rel: A -> released to pool -> A re-assigned
     ('${P}-hist-11','${P}-spot-rel','${P}-user-a','assigned','2026-01-01','${P}-user-adm'),
     ('${P}-hist-12','${P}-spot-rel','${P}-user-a','released','2026-04-01','${P}-user-adm'),
     ('${P}-hist-13','${P}-spot-rel','${P}-user-a','assigned','2026-07-01','${P}-user-adm');

    INSERT INTO spot_listings (id, spot_id, owner_id, listing_type, single_date, period_start_date, period_end_date, status, created_by_admin, created_at, deleted_at, daily_rate) VALUES
     -- spot-pool: pool-era listing damaged by the old broad repair (flipped to owner/false)
     ('${P}-lst-pool-dmg','${P}-spot-pool','${P}-user-a','single','2026-05-10',null,null,'used',false,'2026-05-01',null,15),
     -- spot-pool: soft-deleted admin listing (recovers pool admin identity)
     ('${P}-lst-pool-adm','${P}-spot-pool','${P}-user-adm','single','2026-05-11',null,null,'unused',true,'2026-05-01','2026-07-31',15),
     -- spot-pool: in-tenure swap damage (active admin-flagged on owned spot)
     ('${P}-lst-pool-ten','${P}-spot-pool','${P}-user-adm','single','2026-08-10',null,null,'used',true,'2026-08-05',null,15),
     ('${P}-lst-pool-par','${P}-spot-pool','${P}-user-adm','period',null,'2026-08-01','2026-08-31','cancelled',true,'2026-08-05','2026-08-06',15),
     -- spot-ab: prior owner A's legitimate era listings — must never be touched
     ('${P}-lst-ab-aera','${P}-spot-ab','${P}-user-a','single','2026-02-10',null,null,'used',false,'2026-02-01',null,15),
     -- a surviving soft-deleted admin listing on spot-ab (makes pool_admin recoverable — worst case)
     ('${P}-lst-ab-adm','${P}-spot-ab','${P}-user-adm','single','2026-03-05',null,null,'unused',true,'2026-03-01','2026-05-01',15),
     -- spot-ab: pre-transfer ACTIVE admin-flagged listing (booked, survived the
     -- equal-timestamp A->B transfer) — forward repair must NOT flip it to B
     ('${P}-lst-ab-pre','${P}-spot-ab','${P}-user-adm','single','2026-04-15',null,null,'used',true,'2026-04-10',null,15),
     -- spot-aba: A's legitimate first-tenure listing — untouched
     ('${P}-lst-aba-first','${P}-spot-aba','${P}-user-a','single','2026-02-10',null,null,'used',false,'2026-02-01',null,15),
     ('${P}-lst-aba-adm','${P}-spot-aba','${P}-user-adm','single','2026-05-05',null,null,'unused',true,'2026-05-01','2026-06-01',15),
     -- spot-aba: ACTIVE admin-flagged listing from B's era (equal-timestamp
     -- B->A re-transfer) — forward repair must NOT flip it to A
     ('${P}-lst-aba-pre','${P}-spot-aba','${P}-user-adm','single','2026-05-20',null,null,'used',true,'2026-05-10',null,15),
     -- spot-rel: pool listing created during the released gap, still ACTIVE and admin-flagged
     -- (forward repair must NOT flip it to the owner)
     ('${P}-lst-rel-gap','${P}-spot-rel','${P}-user-adm','single','2026-05-15',null,null,'used',true,'2026-05-15',null,15),
     -- spot-rel: gap-era listing damaged by the old broad repair — must be restored to admin
     ('${P}-lst-rel-dmg','${P}-spot-rel','${P}-user-a','single','2026-05-20',null,null,'used',false,'2026-05-15',null,15),
     -- spot-rel: A's legitimate first-stint listing — untouched
     ('${P}-lst-rel-first','${P}-spot-rel','${P}-user-a','single','2026-02-10',null,null,'used',false,'2026-02-01',null,15);

    INSERT INTO bookings (id, listing_id, spot_id, renter_id, owner_id, booking_date, daily_rate, total_amount, status) VALUES
     ('${P}-bkg-pool-dmg','${P}-lst-pool-dmg','${P}-spot-pool','${P}-user-r','${P}-user-a','2026-05-10',15,15,'completed'),
     ('${P}-bkg-pool-ten','${P}-lst-pool-ten','${P}-spot-pool','${P}-user-r','${P}-user-adm','2026-08-10',15,15,'completed'),
     ('${P}-bkg-ab-aera','${P}-lst-ab-aera','${P}-spot-ab','${P}-user-r','${P}-user-a','2026-02-10',15,15,'completed'),
     ('${P}-bkg-ab-pre','${P}-lst-ab-pre','${P}-spot-ab','${P}-user-r','${P}-user-adm','2026-04-15',15,15,'completed'),
     ('${P}-bkg-aba-pre','${P}-lst-aba-pre','${P}-spot-aba','${P}-user-r','${P}-user-adm','2026-05-20',15,15,'completed'),
     ('${P}-bkg-aba-first','${P}-lst-aba-first','${P}-spot-aba','${P}-user-r','${P}-user-a','2026-02-10',15,15,'completed'),
     ('${P}-bkg-rel-gap','${P}-lst-rel-gap','${P}-spot-rel','${P}-user-r','${P}-user-adm','2026-05-15',15,15,'completed'),
     ('${P}-bkg-rel-dmg','${P}-lst-rel-dmg','${P}-spot-rel','${P}-user-r','${P}-user-a','2026-05-20',15,15,'completed'),
     ('${P}-bkg-rel-first','${P}-lst-rel-first','${P}-spot-rel','${P}-user-r','${P}-user-a','2026-02-10',15,15,'completed');
  `));
}, 60000);

afterAll(async () => {
  await cleanup();
}, 60000);

describe("startup swap repair (transfer semantics, real DB)", () => {
  it("repairs damage in both directions without touching legitimate history, and is idempotent", async () => {
    await runSwapRepair(noLog);
    const { l, b } = await fetchState();

    // 1. pool -> owner: pool-era damage restored to admin/WPS
    expect(l.get(`${P}-lst-pool-dmg`)).toMatchObject({ owner_id: `${P}-user-adm`, created_by_admin: true });
    expect(b.get(`${P}-bkg-pool-dmg`)!.owner_id).toBe(`${P}-user-adm`);
    // in-tenure swap damage forward-repaired to the owner
    expect(l.get(`${P}-lst-pool-ten`)).toMatchObject({ owner_id: `${P}-user-a`, created_by_admin: false });
    expect(b.get(`${P}-bkg-pool-ten`)!.owner_id).toBe(`${P}-user-a`);

    // 2. A -> B (equal-timestamp transfer): prior owner A's era stays with A
    expect(l.get(`${P}-lst-ab-aera`)).toMatchObject({ owner_id: `${P}-user-a`, created_by_admin: false });
    expect(b.get(`${P}-bkg-ab-aera`)!.owner_id).toBe(`${P}-user-a`);
    // pre-transfer ACTIVE admin listing/booking NOT forward-repaired to B
    expect(l.get(`${P}-lst-ab-pre`)).toMatchObject({ owner_id: `${P}-user-adm`, created_by_admin: true });
    expect(b.get(`${P}-bkg-ab-pre`)!.owner_id).toBe(`${P}-user-adm`);

    // 3. A -> B -> A (equal-timestamp re-transfer): A's first-tenure rows untouched
    expect(l.get(`${P}-lst-aba-first`)).toMatchObject({ owner_id: `${P}-user-a`, created_by_admin: false });
    expect(b.get(`${P}-bkg-aba-first`)!.owner_id).toBe(`${P}-user-a`);
    // B-era ACTIVE admin listing/booking NOT forward-repaired to A
    expect(l.get(`${P}-lst-aba-pre`)).toMatchObject({ owner_id: `${P}-user-adm`, created_by_admin: true });
    expect(b.get(`${P}-bkg-aba-pre`)!.owner_id).toBe(`${P}-user-adm`);

    // 4. A -> released -> A: gap pool listing NOT forward-repaired (stays WPS)
    expect(l.get(`${P}-lst-rel-gap`)).toMatchObject({ owner_id: `${P}-user-adm`, created_by_admin: true });
    expect(b.get(`${P}-bkg-rel-gap`)!.owner_id).toBe(`${P}-user-adm`);
    // damaged gap rows restored to admin
    expect(l.get(`${P}-lst-rel-dmg`)).toMatchObject({ owner_id: `${P}-user-adm`, created_by_admin: true });
    expect(b.get(`${P}-bkg-rel-dmg`)!.owner_id).toBe(`${P}-user-adm`);
    // first-stint rows untouched
    expect(l.get(`${P}-lst-rel-first`)).toMatchObject({ owner_id: `${P}-user-a`, created_by_admin: false });
    expect(b.get(`${P}-bkg-rel-first`)!.owner_id).toBe(`${P}-user-a`);

    // 5. Idempotency: second run touches none of the fixture rows
    const before = JSON.stringify([[...l.values()], [...b.values()]]);
    await runSwapRepair(noLog);
    const after = await fetchState();
    expect(JSON.stringify([[...after.l.values()], [...after.b.values()]])).toBe(before);
  }, 120000);
});
