import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearAdminGameModeCookie: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  getAdminGameModeTarget: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/admin-game-mode", () => ({
  clearAdminGameModeCookie: mocks.clearAdminGameModeCookie,
  getAdminGameModeTarget: mocks.getAdminGameModeTarget,
}));

vi.mock("@/lib/auth", () => ({
  requireRole: mocks.requireRole,
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

import { demoteReviewerToTasker, promoteTaskerToReviewer, removeTasker } from "./role-actions";

function createRoleSupabase(user: { id: string; auth0_sub: string; role: string } | null) {
  const maybeSingle = vi.fn(() => ({ data: user, error: null }));
  const selectEq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq: selectEq }));
  const updateEq = vi.fn(() => ({ error: null }));
  const update = vi.fn(() => ({ eq: updateEq }));

  return {
    supabase: {
      from: vi.fn((tableName: string) => {
        expect(tableName).toBe("users");
        return { select, update };
      }),
    },
    select,
    update,
  };
}

function createRemoveSupabase(
  user: { id: string; auth0_sub: string; email: string | null; display_name: string | null; role: string } | null,
) {
  const maybeSingle = vi.fn(() => ({ data: user, error: null }));
  const selectEq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq: selectEq }));
  const usersDeleteEq = vi.fn(() => ({ error: null }));
  const usersDelete = vi.fn(() => ({ eq: usersDeleteEq }));
  const reviewDeleteEq = vi.fn(() => ({ error: null }));
  const reviewDelete = vi.fn(() => ({ eq: reviewDeleteEq }));
  const removedUsersUpsert = vi.fn(() => ({ error: null }));
  const removedUsersDeleteEq = vi.fn(() => ({ error: null }));
  const removedUsersDelete = vi.fn(() => ({ eq: removedUsersDeleteEq }));

  return {
    supabase: {
      from: vi.fn((tableName: string) => {
        if (tableName === "users") {
          return { select, delete: usersDelete };
        }

        if (tableName === "row_reviews") {
          return { delete: reviewDelete };
        }

        if (tableName === "removed_users") {
          return { upsert: removedUsersUpsert, delete: removedUsersDelete };
        }

        throw new Error(`Unexpected table: ${tableName}`);
      }),
    },
    usersDeleteEq,
    reviewDeleteEq,
    removedUsersUpsert,
  };
}

describe("admin role actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ sub: "auth0|admin", role: "admin" });
    mocks.getAdminGameModeTarget.mockResolvedValue(null);
  });

  it("promotes taskers to reviewers and refreshes admin role surfaces", async () => {
    const { supabase, update } = createRoleSupabase({ id: "tasker-id", auth0_sub: "auth0|tasker", role: "tasker" });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    await promoteTaskerToReviewer("tasker-id");

    expect(mocks.requireRole).toHaveBeenCalledWith("admin");
    expect(update).toHaveBeenCalledWith({ role: "reviewer" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/taskers");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/reviewers");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/game-mode");
  });

  it("demotes reviewers to taskers", async () => {
    const { supabase, update } = createRoleSupabase({ id: "reviewer-id", auth0_sub: "auth0|reviewer", role: "reviewer" });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    await demoteReviewerToTasker("reviewer-id");

    expect(update).toHaveBeenCalledWith({ role: "tasker" });
  });

  it("clears the admin mode cookie when the active impersonation target changes role", async () => {
    const { supabase } = createRoleSupabase({ id: "reviewer-id", auth0_sub: "auth0|reviewer", role: "reviewer" });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);
    mocks.getAdminGameModeTarget.mockResolvedValue({ mode: "reviewer", reviewerId: "reviewer-id" });

    await demoteReviewerToTasker("reviewer-id");

    expect(mocks.clearAdminGameModeCookie).toHaveBeenCalled();
  });

  it("does not promote admin game profiles", async () => {
    const { supabase, update } = createRoleSupabase({ id: "shadow-id", auth0_sub: "admin-game|admin-id", role: "tasker" });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    await expect(promoteTaskerToReviewer("shadow-id")).rejects.toThrow("Admin game profiles cannot be promoted to reviewers.");
    expect(update).not.toHaveBeenCalled();
  });

  it("removes taskers and tombstones their auth subject", async () => {
    const { supabase, usersDeleteEq, reviewDeleteEq, removedUsersUpsert } = createRemoveSupabase({
      id: "tasker-id",
      auth0_sub: "auth0|tasker",
      email: "tasker@example.com",
      display_name: "Tasker",
      role: "tasker",
    });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    await removeTasker("tasker-id");

    expect(reviewDeleteEq).toHaveBeenCalledWith("reviewer_id", "tasker-id");
    expect(removedUsersUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        auth0_sub: "auth0|tasker",
        email: "tasker@example.com",
        display_name: "Tasker",
        role: "tasker",
      }),
      { onConflict: "auth0_sub" },
    );
    expect(usersDeleteEq).toHaveBeenCalledWith("id", "tasker-id");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/taskers");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/review/queue");
  });

  it("does not remove admin game profiles", async () => {
    const { supabase, usersDeleteEq } = createRemoveSupabase({
      id: "shadow-id",
      auth0_sub: "admin-game|admin-id",
      email: "admin+game@example.com",
      display_name: "Admin (Game Mode)",
      role: "tasker",
    });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    await expect(removeTasker("shadow-id")).rejects.toThrow("Admin game profiles cannot be removed from the tasker roster.");
    expect(usersDeleteEq).not.toHaveBeenCalled();
  });
});
