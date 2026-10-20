import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { inAppNotifications } from "@shared/schema";

const query = vi.hoisted(() => ({
  update: vi.fn(),
  delete: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
}));

vi.mock("./db", () => ({
  db: {
    ...query,
    // Storage also runs seed checks at construction; report existing fixtures
    // without touching a real database or writing sample data.
    select: () => ({
      from: () => ({
        where: () => ({
          then: (resolve: any) => resolve([{ count: 0 }]),
          limit: async () => [{ id: "existing-seed-listing" }],
        }),
        limit: async () => [{ id: "existing-spot" }],
      }),
    }),
  },
}));
import { MemStorage } from "./storage";

describe("notification storage ownership predicates", () => {
  const storage = new MemStorage();
  const dialect = new PgDialect();

  beforeEach(() => {
    vi.clearAllMocks();
    query.update.mockReturnValue(query);
    query.delete.mockReturnValue(query);
    query.set.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.returning.mockResolvedValue([]);
  });

  function expectOwnershipPredicate() {
    expect(query.where).toHaveBeenCalledTimes(1);
    const { sql, params } = dialect.sqlToQuery(query.where.mock.calls[0][0]);
    expect(sql).toBe('("in_app_notifications"."id" = $1 and "in_app_notifications"."user_id" = $2)');
    expect(params).toEqual(["notification-id", "recipient-id"]);
  }

  it("marks read with an atomic ID-and-recipient update", async () => {
    const notification = { id: "notification-id", userId: "recipient-id", read: true };
    query.returning.mockResolvedValue([notification]);
    expect(await storage.markNotificationAsRead("notification-id", "recipient-id")).toEqual(notification);
    expect(query.update).toHaveBeenCalledWith(inAppNotifications);
    expect(query.set).toHaveBeenCalledWith({ read: true });
    expectOwnershipPredicate();
  });

  it("returns undefined when no owned notification matches the update", async () => {
    expect(await storage.markNotificationAsRead("notification-id", "recipient-id")).toBeUndefined();
    expectOwnershipPredicate();
  });

  it("deletes with an atomic ID-and-recipient predicate", async () => {
    query.returning.mockResolvedValue([{ id: "notification-id" }]);
    expect(await storage.deleteInAppNotification("notification-id", "recipient-id")).toBe(true);
    expect(query.delete).toHaveBeenCalledWith(inAppNotifications);
    expectOwnershipPredicate();
  });

  it("returns false when no owned notification matches the delete", async () => {
    expect(await storage.deleteInAppNotification("notification-id", "recipient-id")).toBe(false);
    expectOwnershipPredicate();
  });
});
