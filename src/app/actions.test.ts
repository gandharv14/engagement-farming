import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getMyUserRow: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  requireRole: vi.fn(),
  requireReviewerGameContext: vi.fn(),
  requireTaskerGameContext: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/admin-game-mode", () => ({
  requireReviewerGameContext: mocks.requireReviewerGameContext,
  requireTaskerGameContext: mocks.requireTaskerGameContext,
}));

vi.mock("@/lib/auth", () => ({
  requireRole: mocks.requireRole,
}));

vi.mock("@/lib/data", () => ({
  getMyUserRow: mocks.getMyUserRow,
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

import { releaseExpiredReviewReservations, releaseReviewReservation, reserveReviewRow, reviewRow, submitRow, updateSprintConfig } from "./actions";

type TableMocks = Record<string, Record<string, ReturnType<typeof vi.fn>>>;

function formData(values: Record<string, string>) {
  const data = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    data.set(key, value);
  });

  return data;
}

function createSubmitSupabase(options: { submissionsToday?: number; countError?: Error; insertError?: Error } = {}) {
  const lt = vi.fn(() => ({ count: options.submissionsToday ?? 0, error: options.countError ?? null }));
  const gte = vi.fn(() => ({ lt }));
  const eq = vi.fn(() => ({ gte }));
  const select = vi.fn(() => ({ eq }));
  const insert = vi.fn(() => ({ error: options.insertError ?? null }));
  const table = { select, insert };

  return {
    supabase: {
      from: vi.fn((tableName: string) => {
        expect(tableName).toBe("rows");
        return table;
      }),
    },
    table,
    query: { eq, gte, lt },
  };
}

function createReviewSupabase(options: { updateError?: Error; upsertError?: Error; updatedRow?: { id: string } | null } = {}) {
  const mutationResult = {
    data: options.updatedRow === undefined ? { id: "row-id" } : options.updatedRow,
    error: options.updateError ?? null,
  };
  const rowQuery = {
    data: mutationResult.data,
    error: mutationResult.error,
    eq: vi.fn(),
    gt: vi.fn(),
    lte: vi.fn(),
    not: vi.fn(),
    or: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(() => Promise.resolve(mutationResult)),
  };
  rowQuery.eq.mockReturnValue(rowQuery);
  rowQuery.gt.mockReturnValue(rowQuery);
  rowQuery.lte.mockReturnValue(rowQuery);
  rowQuery.not.mockReturnValue(rowQuery);
  rowQuery.or.mockReturnValue(rowQuery);
  rowQuery.select.mockReturnValue(rowQuery);
  const update = vi.fn(() => rowQuery);
  const reviewUpsert = vi.fn(() => ({ error: options.upsertError ?? null }));
  const tables: TableMocks = {
    rows: { update },
    row_reviews: { upsert: reviewUpsert },
  };

  return {
    supabase: {
      from: vi.fn((tableName: string) => tables[tableName]),
    },
    rowQuery,
    update,
    reviewUpsert,
  };
}

function createSprintConfigSupabase(options: { taskerCount?: number; taskerCountError?: Error; configError?: Error; milestoneError?: Error } = {}) {
  const usersIs = vi.fn(() => ({ count: options.taskerCount ?? 8, error: options.taskerCountError ?? null }));
  const usersEq = vi.fn(() => ({ is: usersIs }));
  const usersSelect = vi.fn(() => ({ eq: usersEq }));
  const configUpsert = vi.fn(() => ({ error: options.configError ?? null }));
  const milestoneUpsert = vi.fn(() => ({ error: options.milestoneError ?? null }));
  const tables: TableMocks = {
    users: { select: usersSelect },
    sprint_config: { upsert: configUpsert },
    milestones: { upsert: milestoneUpsert },
  };

  return {
    supabase: {
      from: vi.fn((tableName: string) => tables[tableName]),
    },
    configUpsert,
    milestoneUpsert,
    usersSelect,
  };
}

function validSubmissionForm(overrides: Record<string, string> = {}) {
  return formData({
    problemId: "live-compare-123",
    taskType: "Debugging",
    tokenCount: "3210",
    taigaProblemUrl: "https://taiga.example.com/project/live-compare/us/123",
    ...overrides,
  });
}

function validSprintConfigForm(overrides: Record<string, string> = {}) {
  return formData({
    sprintStartDate: "2026-05-22",
    sprintEndDate: "2026-06-02",
    currentPhase: "steady",
    qualityMultiplier: "1.5",
    endgameBountyAmountCents: "2500",
    collectiveGoalRows: "100",
    collectiveStretchRows: "200",
    tier1ThresholdRows: "5",
    tier2ThresholdRows: "10",
    tier3ThresholdRows: "25",
    ...overrides,
  });
}

describe("server actions", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.requireTaskerGameContext.mockResolvedValue({
      tasker: {
        id: "tasker-id",
        auth0_sub: "auth0|tasker",
        email: "tasker@example.com",
        display_name: "Tasker One",
        role: "tasker",
      },
    });
    mocks.requireRole.mockResolvedValue({ sub: "auth0|reviewer", role: "reviewer" });
    mocks.requireReviewerGameContext.mockResolvedValue({
      sessionUser: { sub: "auth0|reviewer", role: "reviewer" },
      reviewer: {
        id: "reviewer-id",
        auth0_sub: "auth0|reviewer",
        email: "reviewer@example.com",
        display_name: "Reviewer One",
        role: "reviewer",
      },
      isAdminGameMode: false,
      gameModeLabel: null,
    });
    mocks.getMyUserRow.mockResolvedValue({
      id: "reviewer-id",
      auth0_sub: "auth0|reviewer",
      email: "reviewer@example.com",
      display_name: "Reviewer One",
      role: "reviewer",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("submitRow", () => {
    it("inserts a pending row for the active tasker and revalidates the dashboard", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-22T23:45:00.000Z"));
      const { supabase, table, query } = createSubmitSupabase();
      mocks.createSupabaseServerClient.mockResolvedValue(supabase);

      await submitRow(validSubmissionForm());

      expect(query.gte).toHaveBeenCalledWith("submitted_at", "2026-05-22T00:00:00.000Z");
      expect(query.lt).toHaveBeenCalledWith("submitted_at", "2026-05-23T00:00:00.000Z");
      expect(table.insert).toHaveBeenCalledWith({
        tasker_id: "tasker-id",
        status: "pending_review",
        metadata: {
          problem_id: "live-compare-123",
          task_type: "Debugging",
          token_count: 3210,
          taiga_problem_url: "https://taiga.example.com/project/live-compare/us/123",
        },
      });
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    });

    it("rejects invalid task types before counting or inserting rows", async () => {
      const { supabase, table } = createSubmitSupabase();
      mocks.createSupabaseServerClient.mockResolvedValue(supabase);

      await expect(submitRow(validSubmissionForm({ taskType: "Unconfigured task" }))).rejects.toThrow(
        "Task type must be one of the configured options.",
      );

      expect(table.select).not.toHaveBeenCalled();
      expect(table.insert).not.toHaveBeenCalled();
    });

    it("rejects non-http Taiga links", async () => {
      const { supabase, table } = createSubmitSupabase();
      mocks.createSupabaseServerClient.mockResolvedValue(supabase);

      await expect(submitRow(validSubmissionForm({ taigaProblemUrl: "mailto:taiga@example.com" }))).rejects.toThrow(
        "Taiga problem link must be an HTTP or HTTPS URL.",
      );

      expect(table.insert).not.toHaveBeenCalled();
    });

    it("enforces the daily submission limit", async () => {
      const { supabase, table } = createSubmitSupabase({ submissionsToday: 4 });
      mocks.createSupabaseServerClient.mockResolvedValue(supabase);

      await expect(submitRow(validSubmissionForm())).rejects.toThrow("Daily submission limit reached (4 problems).");

      expect(table.insert).not.toHaveBeenCalled();
    });
  });

  describe("reviewRow", () => {
    it("persists review outcomes, notes, and redirects back to the queue", async () => {
      const { supabase, reviewUpsert, rowQuery, update } = createReviewSupabase();
      mocks.createSupabaseServerClient.mockResolvedValue(supabase);

      await expect(
        reviewRow(
          "row-id",
          formData({
            status: "accepted_clean",
            notes: "Looks good.",
          }),
        ),
      ).rejects.toThrow("NEXT_REDIRECT:/review/queue");

      expect(mocks.requireReviewerGameContext).toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith({
        status: "accepted_clean",
        reviewer_id: "reviewer-id",
        reviewed_at: expect.any(String),
        reserved_by: null,
        reserved_until: null,
      });
      expect(rowQuery.eq).toHaveBeenCalledWith("reserved_by", "reviewer-id");
      expect(rowQuery.gt).toHaveBeenCalledWith("reserved_until", expect.any(String));
      expect(reviewUpsert).toHaveBeenCalledWith({
        row_id: "row-id",
        reviewer_id: "reviewer-id",
        notes: "Looks good.",
      });
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/review/queue");
    });

    it("rejects unsupported review statuses before updating rows", async () => {
      const { supabase, update } = createReviewSupabase();
      mocks.createSupabaseServerClient.mockResolvedValue(supabase);

      await expect(reviewRow("row-id", formData({ status: "accepted_with_edits" }))).rejects.toThrow(
        "Invalid review status.",
      );

      expect(update).not.toHaveBeenCalled();
      expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it("requires an active reservation owned by the reviewer before completing a row", async () => {
      const { supabase } = createReviewSupabase({ updatedRow: null });
      mocks.createSupabaseServerClient.mockResolvedValue(supabase);

      await expect(reviewRow("row-id", formData({ status: "rejected" }))).rejects.toThrow(
        "Review reservation expired or belongs to another reviewer.",
      );

      expect(mocks.redirect).not.toHaveBeenCalled();
    });
  });

  describe("review reservations", () => {
    it("reserves an available row for five minutes and redirects to the detail page", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-22T16:00:00.000Z"));
      const { supabase, rowQuery, update } = createReviewSupabase();
      mocks.createSupabaseServerClient.mockResolvedValue(supabase);

      await expect(reserveReviewRow("row-id")).rejects.toThrow("NEXT_REDIRECT:/review/row-id");

      expect(update).toHaveBeenCalledWith({ reserved_by: null, reserved_until: null });
      expect(update).toHaveBeenCalledWith({
        reserved_by: "reviewer-id",
        reserved_until: "2026-05-22T16:05:00.000Z",
        reviewer_id: null,
        reviewed_at: null,
      });
      expect(rowQuery.or).toHaveBeenCalledWith(
        "reserved_by.is.null,reserved_by.eq.reviewer-id,reserved_until.lte.2026-05-22T16:00:00.000Z",
      );
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/review/queue");
    });

    it("blocks reservation when another reviewer owns an active hold", async () => {
      const { supabase, update } = createReviewSupabase({ updatedRow: null });
      mocks.createSupabaseServerClient.mockResolvedValue(supabase);

      await expect(reserveReviewRow("row-id")).rejects.toThrow("This row is already reserved by another reviewer.");

      expect(update).toHaveBeenCalledTimes(2);
      expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it("releases the current reviewer's reservation", async () => {
      const { supabase, rowQuery, update } = createReviewSupabase();
      mocks.createSupabaseServerClient.mockResolvedValue(supabase);

      await releaseReviewReservation("row-id");

      expect(update).toHaveBeenCalledWith({ reserved_by: null, reserved_until: null });
      expect(rowQuery.eq).toHaveBeenCalledWith("id", "row-id");
      expect(rowQuery.eq).toHaveBeenCalledWith("status", "pending_review");
      expect(rowQuery.eq).toHaveBeenCalledWith("reserved_by", "reviewer-id");
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/review/queue");
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/review/row-id");
    });

    it("clears expired reservations from the pending queue", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-22T16:00:00.000Z"));
      const { supabase, rowQuery, update } = createReviewSupabase();
      mocks.createSupabaseServerClient.mockResolvedValue(supabase);

      await releaseExpiredReviewReservations();

      expect(update).toHaveBeenCalledWith({ reserved_by: null, reserved_until: null });
      expect(rowQuery.eq).toHaveBeenCalledWith("status", "pending_review");
      expect(rowQuery.lte).toHaveBeenCalledWith("reserved_until", "2026-05-22T16:00:00.000Z");
      expect(rowQuery.not).toHaveBeenCalledWith("reserved_by", "is", null);
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/review/queue");
    });
  });

  describe("updateSprintConfig", () => {
    it("saves valid sprint settings and milestone tiers before redirecting", async () => {
      const { supabase, configUpsert, milestoneUpsert } = createSprintConfigSupabase();
      mocks.createSupabaseServerClient.mockResolvedValue(supabase);

      await expect(updateSprintConfig(validSprintConfigForm())).rejects.toThrow("NEXT_REDIRECT:/admin/config?saved=1");

      expect(mocks.requireRole).toHaveBeenCalledWith("admin");
      expect(configUpsert).toHaveBeenCalledWith({
        id: 1,
        sprint_start_date: "2026-05-22",
        sprint_end_date: "2026-06-02",
        current_phase: "steady",
        quality_multiplier: 1.5,
        endgame_bounty_active: false,
        endgame_bounty_amount_cents: 2500,
        collective_goal_rows: 100,
        collective_stretch_rows: 200,
      });
      expect(milestoneUpsert).toHaveBeenCalledWith([
        { id: 1, threshold_rows: 5, tier_label: "Tier 1" },
        { id: 2, threshold_rows: 10, tier_label: "Tier 2" },
        { id: 3, threshold_rows: 25, tier_label: "Tier 3" },
      ]);
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/goodies");
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/config");
    });

    it("redirects validation errors without saving partial config", async () => {
      const { supabase, configUpsert, milestoneUpsert } = createSprintConfigSupabase();
      mocks.createSupabaseServerClient.mockResolvedValue(supabase);

      await expect(
        updateSprintConfig(
          validSprintConfigForm({
            tier2ThresholdRows: "5",
          }),
        ),
      ).rejects.toThrow("NEXT_REDIRECT:");

      const redirectUrl = mocks.redirect.mock.calls.at(-1)?.[0] ?? "";
      expect(new URLSearchParams(redirectUrl.split("?")[1]).get("error")).toBe("Goodie milestone thresholds must be unique.");
      expect(configUpsert).not.toHaveBeenCalled();
      expect(milestoneUpsert).not.toHaveBeenCalled();
    });
  });
});
