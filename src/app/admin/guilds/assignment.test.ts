import { describe, expect, it } from "vitest";

import { computeBalancedGuildAssignments } from "./assignment";

describe("computeBalancedGuildAssignments", () => {
  it("assigns unassigned taskers to the currently smallest guilds", () => {
    const assignments = computeBalancedGuildAssignments({
      guilds: [{ id: "alpha" }, { id: "beta" }, { id: "gamma" }],
      taskers: [{ id: "tasker-1" }, { id: "tasker-2" }, { id: "tasker-3" }, { id: "tasker-4" }],
      memberships: [
        { user_id: "existing-1", guild_id: "alpha" },
        { user_id: "existing-2", guild_id: "alpha" },
        { user_id: "existing-3", guild_id: "beta" },
      ],
    });

    expect(assignments).toEqual([
      { user_id: "tasker-1", guild_id: "gamma" },
      { user_id: "tasker-2", guild_id: "beta" },
      { user_id: "tasker-3", guild_id: "gamma" },
      { user_id: "tasker-4", guild_id: "alpha" },
    ]);
  });

  it("preserves existing tasker assignments", () => {
    const assignments = computeBalancedGuildAssignments({
      guilds: [{ id: "alpha" }, { id: "beta" }],
      taskers: [{ id: "assigned-tasker" }, { id: "new-tasker" }],
      memberships: [{ user_id: "assigned-tasker", guild_id: "alpha" }],
    });

    expect(assignments).toEqual([{ user_id: "new-tasker", guild_id: "beta" }]);
  });

  it("does nothing when every tasker already has a guild", () => {
    const assignments = computeBalancedGuildAssignments({
      guilds: [{ id: "alpha" }, { id: "beta" }],
      taskers: [{ id: "tasker-1" }, { id: "tasker-2" }],
      memberships: [
        { user_id: "tasker-1", guild_id: "alpha" },
        { user_id: "tasker-2", guild_id: "beta" },
      ],
    });

    expect(assignments).toEqual([]);
  });

  it("requires at least one guild when taskers need assignment", () => {
    expect(() =>
      computeBalancedGuildAssignments({
        guilds: [],
        taskers: [{ id: "tasker-1" }],
        memberships: [],
      }),
    ).toThrow("Create at least one guild before auto-assigning taskers.");
  });
});
