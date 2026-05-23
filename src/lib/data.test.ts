import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

import { formatCurrency, formatSource, getAdminDashboard, getReviewDetail, getReviewQueue, getTaskerDashboard } from "./data";

type QueryOperation = {
  name: string;
  args: unknown[];
};

type QueryState = {
  table: string;
  operations: QueryOperation[];
};

type QueryResult = {
  count?: number | null;
  data?: unknown;
  error?: { message: string } | null;
};

type TableFixture = QueryResult | ((state: QueryState) => QueryResult);

type SupabaseFixture = {
  rpc?: (name: string, params: Record<string, unknown>) => QueryResult;
  tables: Record<string, TableFixture>;
};

class MockQuery {
  private readonly operations: QueryOperation[] = [];

  constructor(
    private readonly table: string,
    private readonly fixture: SupabaseFixture,
  ) {}

  select(...args: unknown[]) {
    return this.record("select", args);
  }

  update(...args: unknown[]) {
    return this.record("update", args);
  }

  eq(...args: unknown[]) {
    return this.record("eq", args);
  }

  gt(...args: unknown[]) {
    return this.record("gt", args);
  }

  gte(...args: unknown[]) {
    return this.record("gte", args);
  }

  lte(...args: unknown[]) {
    return this.record("lte", args);
  }

  lt(...args: unknown[]) {
    return this.record("lt", args);
  }

  not(...args: unknown[]) {
    return this.record("not", args);
  }

  order(...args: unknown[]) {
    return this.record("order", args);
  }

  in(...args: unknown[]) {
    return this.record("in", args);
  }

  is(...args: unknown[]) {
    return this.record("is", args);
  }

  maybeSingle() {
    return Promise.resolve(this.resolve());
  }

  single() {
    return Promise.resolve(this.resolve());
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }

  private record(name: string, args: unknown[]) {
    this.operations.push({ name, args });
    return this;
  }

  private resolve(): QueryResult {
    const tableFixture = this.fixture.tables[this.table];

    if (typeof tableFixture === "function") {
      return tableFixture({ table: this.table, operations: this.operations });
    }

    return tableFixture ?? { data: null, error: null };
  }
}

class MockRpcQuery {
  constructor(
    private readonly name: string,
    private readonly params: Record<string, unknown>,
    private readonly fixture: SupabaseFixture,
  ) {}

  maybeSingle() {
    return Promise.resolve(this.resolve());
  }

  private resolve(): QueryResult {
    return this.fixture.rpc?.(this.name, this.params) ?? { data: null, error: null };
  }
}

function createSupabaseMock(fixture: SupabaseFixture) {
  return {
    from: vi.fn((table: string) => new MockQuery(table, fixture)),
    rpc: vi.fn((name: string, params: Record<string, unknown>) => new MockRpcQuery(name, params, fixture)),
  };
}

describe("data helpers", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("formats money and source labels for UI surfaces", () => {
    expect(formatCurrency(123456)).toBe("$1,234.56");
    expect(formatSource("quality_bonus")).toBe("Quality Bonus");
  });

  it("builds the tasker dashboard from rows, streaks, milestones, and earnings", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-22T16:00:00.000Z"));

    const supabase = createSupabaseMock({
      rpc: (_name, params) => ({
        data: params.p_include_pending ? { current_streak_days: 5, longest_streak_days: 5 } : { current_streak_days: 3, longest_streak_days: 4 },
        error: null,
      }),
      tables: {
        sprint_public_config: {
          data: {
            current_phase: "steady",
            quality_multiplier: 1.5,
            endgame_bounty_active: true,
            collective_goal_rows: 100,
            collective_stretch_rows: 200,
            current_sprint_day: 3,
            total_sprint_days: 12,
          },
          error: null,
        },
        users: {
          data: {
            id: "tasker-id",
            auth0_sub: "auth0|tasker",
            email: "tasker@example.com",
            display_name: "Tasker One",
            role: "tasker",
          },
          error: null,
        },
        rows: {
          data: [
            {
              id: "accepted-clean",
              status: "accepted_clean",
              submitted_at: "2026-05-22T10:00:00.000Z",
              metadata: {
                problem_id: "accepted-clean-problem",
                task_type: "Debugging",
                token_count: 1200,
                taiga_problem_url: "https://taiga.example.com/accepted-clean",
              },
            },
            {
              id: "accepted-edits",
              status: "accepted_with_edits",
              submitted_at: "2026-05-20T10:00:00.000Z",
              metadata: {
                external_row_id: "external-accepted-edits",
                task_type: "Code review",
                token_count: 2400,
              },
            },
            {
              id: "pending",
              status: "pending_review",
              submitted_at: "2026-05-22T11:00:00.000Z",
              metadata: {
                problem_id: "pending-problem",
                task_type: "Testing",
                token_count: 3600,
              },
            },
            {
              id: "rejected",
              status: "rejected",
              submitted_at: "2026-05-19T11:00:00.000Z",
              metadata: {},
            },
          ],
          error: null,
        },
        streaks: {
          data: {
            current_streak_days: 3,
            longest_streak_days: 4,
          },
          error: null,
        },
        milestone_achievements: {
          data: [{ id: "achievement-1" }],
          error: null,
        },
        earnings: {
          data: [
            { source: "quality_bonus", amount_cents: 100 },
            { source: "quality_bonus", amount_cents: 250 },
            { source: "streak_bonus", amount_cents: 50 },
          ],
          error: null,
        },
        milestones: {
          data: [
            { threshold_rows: 1, tier_label: "Tier 1" },
            { threshold_rows: 3, tier_label: "Tier 2" },
            { threshold_rows: 5, tier_label: "Tier 3" },
          ],
          error: null,
        },
      },
    });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    const dashboard = await getTaskerDashboard("auth0|tasker");

    expect(dashboard.acceptedRows).toBe(1);
    expect(dashboard.pendingRows).toBe(1);
    expect(dashboard.currentStreak).toBe(3);
    expect(dashboard.potentialStreak).toBe(5);
    expect(dashboard.pendingStreakDelta).toBe(2);
    expect(dashboard.submittedToday).toBe(true);
    expect(dashboard.submissionsToday).toBe(2);
    expect(dashboard.totalEarnedCents).toBe(400);
    expect(dashboard.sourceBreakdown).toEqual({ quality_bonus: 350, streak_bonus: 50 });
    expect(dashboard.pendingRowSummaries).toEqual([
      {
        id: "pending",
        submitted_at: "2026-05-22T11:00:00.000Z",
        status: "pending_review",
        problemId: "pending-problem",
        taskType: "Testing",
        tokenCount: 3600,
        taigaProblemUrl: null,
      },
    ]);
    expect(dashboard.milestoneRoadmap).toEqual([
      { threshold: 1, tierLabel: "Tier 1", progress: 100, remainingRows: 0, status: "unlocked" },
      { threshold: 3, tierLabel: "Tier 2", progress: 33, remainingRows: 2, status: "current" },
      { threshold: 5, tierLabel: "Tier 3", progress: 20, remainingRows: 4, status: "locked" },
    ]);
    expect(dashboard.nextMilestone).toEqual({ threshold: 3, tierLabel: "Tier 2", progress: 33 });
  });

  it("hydrates review queue rows with tasker labels and potential streaks", async () => {
    const supabase = createSupabaseMock({
      rpc: (_name, params) => {
        const taskerId = String(params.p_user_id);
        const includePending = Boolean(params.p_include_pending);
        const current = taskerId === "tasker-two" ? 0 : 3;
        const potential = taskerId === "tasker-two" ? 1 : 2;

        return {
          data: { current_streak_days: includePending ? potential : current, longest_streak_days: Math.max(current, potential) },
          error: null,
        };
      },
      tables: {
        rows: {
          data: [
            {
              id: "row-one",
              tasker_id: "tasker-one",
              submitted_at: "2026-05-22T10:00:00.000Z",
              reserved_by: null,
              reserved_until: null,
              metadata: { problem_id: "problem-one" },
            },
            {
              id: "row-two",
              tasker_id: "tasker-two",
              submitted_at: "2026-05-22T11:00:00.000Z",
              reserved_by: null,
              reserved_until: null,
              metadata: { problem_id: "problem-two" },
            },
          ],
          error: null,
        },
        users: {
          data: [
            { id: "tasker-one", display_name: "Tara Tasker", email: "tara@example.com" },
            { id: "tasker-two", display_name: null, email: "fallback@example.com" },
          ],
          error: null,
        },
      },
    });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    const queue = await getReviewQueue();

    expect(queue).toEqual([
      {
        id: "row-one",
        tasker_id: "tasker-one",
        submitted_at: "2026-05-22T10:00:00.000Z",
        reserved_by: null,
        reserved_until: null,
        metadata: { problem_id: "problem-one" },
        tasker_display_name: "Tara Tasker",
        tasker_current_streak_days: 3,
        tasker_potential_streak_days: 3,
      },
      {
        id: "row-two",
        tasker_id: "tasker-two",
        submitted_at: "2026-05-22T11:00:00.000Z",
        reserved_by: null,
        reserved_until: null,
        metadata: { problem_id: "problem-two" },
        tasker_display_name: "fallback@example.com",
        tasker_current_streak_days: 0,
        tasker_potential_streak_days: 1,
      },
    ]);
  });

  it("keeps actively reserved rows out of other reviewers' queues while preserving owned and expired holds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-22T16:00:00.000Z"));
    const supabase = createSupabaseMock({
      rpc: () => ({
        data: { current_streak_days: 1, longest_streak_days: 1 },
        error: null,
      }),
      tables: {
        rows: {
          data: [
            {
              id: "available",
              tasker_id: "tasker-one",
              submitted_at: "2026-05-22T10:00:00.000Z",
              reserved_by: null,
              reserved_until: null,
              metadata: { problem_id: "available" },
            },
            {
              id: "owned",
              tasker_id: "tasker-one",
              submitted_at: "2026-05-22T11:00:00.000Z",
              reserved_by: "reviewer-one",
              reserved_until: "2026-05-22T16:04:00.000Z",
              metadata: { problem_id: "owned" },
            },
            {
              id: "other-active",
              tasker_id: "tasker-one",
              submitted_at: "2026-05-22T12:00:00.000Z",
              reserved_by: "reviewer-two",
              reserved_until: "2026-05-22T16:04:00.000Z",
              metadata: { problem_id: "other-active" },
            },
            {
              id: "expired",
              tasker_id: "tasker-one",
              submitted_at: "2026-05-22T13:00:00.000Z",
              reserved_by: "reviewer-two",
              reserved_until: "2026-05-22T15:59:00.000Z",
              metadata: { problem_id: "expired" },
            },
          ],
          error: null,
        },
        users: {
          data: [{ id: "tasker-one", display_name: "Tara Tasker", email: "tara@example.com" }],
          error: null,
        },
      },
    });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    const queue = await getReviewQueue("reviewer-one");

    expect(queue.map((row) => row.id)).toEqual(["available", "owned", "expired"]);
  });

  it("only returns review details for an active reservation owned by the reviewer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-22T16:00:00.000Z"));
    const supabase = createSupabaseMock({
      rpc: () => ({
        data: { current_streak_days: 2, longest_streak_days: 2 },
        error: null,
      }),
      tables: {
        rows: ({ operations }) => {
          if (operations.some((operation) => operation.name === "update")) {
            return { data: null, error: null };
          }

          return {
            data: {
              id: "reserved-row",
              tasker_id: "tasker-one",
              submitted_at: "2026-05-22T10:00:00.000Z",
              status: "pending_review",
              reserved_by: "reviewer-one",
              reserved_until: "2026-05-22T16:04:00.000Z",
              metadata: { problem_id: "reserved-row" },
            },
            error: null,
          };
        },
        users: {
          data: [{ id: "tasker-one", display_name: "Tara Tasker", email: "tara@example.com" }],
          error: null,
        },
      },
    });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    await expect(getReviewDetail("reserved-row", "reviewer-one")).resolves.toMatchObject({
      id: "reserved-row",
      reserved_by: "reviewer-one",
      tasker_display_name: "Tara Tasker",
    });
    await expect(getReviewDetail("reserved-row", "reviewer-two")).resolves.toBeNull();
  });

  it("summarizes admin accepted rows, spend, margin, and burndown targets", async () => {
    const supabase = createSupabaseMock({
      tables: {
        rows: {
          data: [
            { submitted_at: "2026-05-22T10:00:00.000Z", status: "accepted_clean" },
            { submitted_at: "2026-05-22T11:00:00.000Z", status: "accepted_with_edits" },
            { submitted_at: "2026-05-22T12:00:00.000Z", status: "rejected" },
          ],
          error: null,
        },
        earnings: {
          data: [
            { source: "quality_bonus", amount_cents: 1500 },
            { source: "quality_bonus", amount_cents: 500 },
            { source: "streak_bonus", amount_cents: 1000 },
          ],
          error: null,
        },
        sprint_config: {
          data: { collective_goal_rows: 50 },
          error: null,
        },
        program_economics: {
          data: { budget_cents: 10_000, revenue_cents: 12_000 },
          error: null,
        },
      },
    });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);

    const dashboard = await getAdminDashboard();

    expect(dashboard).toEqual({
      acceptedRows: 1,
      targetRows: 50,
      budgetCents: 10_000,
      revenueCents: 12_000,
      spendCents: 3_000,
      grossMarginPercent: 75,
      sourceSpend: [
        { source: "quality_bonus", amount_cents: 2_000 },
        { source: "streak_bonus", amount_cents: 1_000 },
      ],
      burndown: [
        { day: "Start", accepted: 0, target: 0 },
        { day: "Today", accepted: 1, target: 50 },
      ],
    });
  });
});
