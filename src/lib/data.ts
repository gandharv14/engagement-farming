import { createSupabaseServerClient } from "@/lib/supabase";
import { MAX_PROBLEMS_PER_TASKER_PER_DAY } from "@/lib/sprint-config";
import { isReviewReservationActive } from "@/lib/review-reservations";

export const acceptedStatuses = ["accepted_clean"] as const;

export type AppUserRow = {
  id: string;
  auth0_sub: string;
  email: string | null;
  display_name: string | null;
  role: "tasker" | "reviewer" | "admin";
  admin_game_owner_id?: string | null;
};

export type SprintPublicConfig = {
  current_phase: "warmup" | "steady" | "finale";
  quality_multiplier: number;
  endgame_bounty_active: boolean;
  collective_goal_rows: number;
  collective_stretch_rows: number;
  current_sprint_day: number;
  total_sprint_days: number;
};

export type TaskerDashboardData = {
  config: SprintPublicConfig;
  acceptedRows: number;
  pendingRows: number;
  currentStreak: number;
  longestStreak: number;
  potentialStreak: number;
  pendingStreakDelta: number;
  milestonesUnlocked: number;
  milestoneRoadmap: MilestoneRoadmapItem[];
  totalEarnedCents: number;
  sourceBreakdown: Record<string, number>;
  submittedToday: boolean;
  submissionsToday: number;
  maxDailySubmissions: number;
  submittedRowSummaries: SubmittedRowSummary[];
  pendingRowSummaries: PendingRowSummary[];
  nextMilestone: {
    threshold: number;
    tierLabel: string;
    progress: number;
  } | null;
};

export type MilestoneRoadmapItem = {
  threshold: number;
  tierLabel: string;
  progress: number;
  remainingRows: number;
  status: "unlocked" | "current" | "locked";
};

export type PendingRowSummary = {
  id: string;
  submitted_at: string;
  problemId: string;
  taskType: string;
  tokenCount: number;
};

export type SubmittedRowSummary = PendingRowSummary & {
  status: string;
  taigaProblemUrl: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  display_name: string;
  metric: string;
};

export type GuildData = {
  myGuild: string | null;
  roster: string[];
  standings: { rank: number; name: string; accepted_rows: number }[];
};

export type Goodie = {
  id: string;
  tier_label: string;
  name: string;
  description: string | null;
  available: boolean;
};

export type MilestoneAchievement = {
  id: string;
  milestone_id: number;
  goodie_id: string | null;
  fulfilled_at: string | null;
};

export type Earning = {
  id: string;
  source: string;
  amount_cents: number;
  awarded_at: string;
};

export type ReviewQueueRow = {
  id: string;
  tasker_id: string;
  tasker_display_name: string;
  tasker_current_streak_days: number;
  tasker_potential_streak_days: number;
  submitted_at: string;
  reserved_by: string | null;
  reserved_until: string | null;
  metadata: Record<string, unknown>;
};

export type ReviewDetail = ReviewQueueRow & {
  status: string;
};

export type ReviewerDashboardRow = ReviewQueueRow & {
  status: string;
  reviewer_id: string | null;
  reviewed_at: string | null;
  reserved_by_display_name: string | null;
  reviewer_display_name: string | null;
};

export type ReviewerDashboardData = {
  availableRows: ReviewerDashboardRow[];
  reservedRows: ReviewerDashboardRow[];
  reviewedRows: ReviewerDashboardRow[];
};

export type AdminDashboardData = {
  acceptedRows: number;
  targetRows: number;
  budgetCents: number;
  revenueCents: number;
  spendCents: number;
  grossMarginPercent: number;
  sourceSpend: { source: string; amount_cents: number }[];
  burndown: { day: string; accepted: number; target: number }[];
};

const fallbackConfig: SprintPublicConfig = {
  current_phase: "warmup",
  quality_multiplier: 1,
  endgame_bounty_active: false,
  collective_goal_rows: 1000,
  collective_stretch_rows: 2000,
  current_sprint_day: 1,
  total_sprint_days: 12,
};

const fallbackMilestones = [
  { threshold_rows: 5, tier_label: "Tier 1" },
  { threshold_rows: 10, tier_label: "Tier 2" },
  { threshold_rows: 25, tier_label: "Tier 3" },
];

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

type TaskerDashboardRow = {
  id: string;
  status: string;
  submitted_at: string;
  metadata: Record<string, unknown>;
};

type StreakSnapshot = {
  current_streak_days: number;
  longest_streak_days: number;
  last_active_date: string | null;
  streak_started_on: string | null;
};

const emptyStreakSnapshot: StreakSnapshot = {
  current_streak_days: 0,
  longest_streak_days: 0,
  last_active_date: null,
  streak_started_on: null,
};

function normalizeStreakSnapshot(row: Partial<StreakSnapshot> | null | undefined): StreakSnapshot {
  return {
    current_streak_days: Number(row?.current_streak_days ?? 0),
    longest_streak_days: Number(row?.longest_streak_days ?? 0),
    last_active_date: row?.last_active_date ?? null,
    streak_started_on: row?.streak_started_on ?? null,
  };
}

async function getStreakSnapshot(supabase: SupabaseServerClient, userId: string, includePending: boolean) {
  const { data, error } = await supabase
    .rpc("calculate_streak_snapshot", {
      p_user_id: userId,
      p_include_pending: includePending,
    })
    .maybeSingle();

  if (error) {
    return emptyStreakSnapshot;
  }

  return normalizeStreakSnapshot(data as Partial<StreakSnapshot> | null);
}

function rowProblemId(row: { id: string; metadata: Record<string, unknown> }) {
  return String(row.metadata.problem_id ?? row.metadata.external_row_id ?? row.id);
}

function rowTaskType(row: { metadata: Record<string, unknown> }) {
  return String(row.metadata.task_type ?? "long-horizon");
}

function rowTokenCount(row: { metadata: Record<string, unknown> }) {
  return Number(row.metadata.token_count ?? 0);
}

function rowTaigaProblemUrl(row: { metadata: Record<string, unknown> }) {
  return typeof row.metadata.taiga_problem_url === "string" && row.metadata.taiga_problem_url ? row.metadata.taiga_problem_url : null;
}

function buildSubmittedRowSummary(row: TaskerDashboardRow): SubmittedRowSummary {
  return {
    id: row.id,
    submitted_at: row.submitted_at,
    status: row.status,
    problemId: rowProblemId(row),
    taskType: rowTaskType(row),
    tokenCount: rowTokenCount(row),
    taigaProblemUrl: rowTaigaProblemUrl(row),
  };
}

function buildMilestoneRoadmap(milestones: { threshold_rows: number; tier_label: string }[], acceptedRows: number): MilestoneRoadmapItem[] {
  const sortedMilestones = [...milestones].sort((left, right) => left.threshold_rows - right.threshold_rows);
  const nextMilestoneIndex = sortedMilestones.findIndex((milestone) => acceptedRows < milestone.threshold_rows);
  const currentMilestoneIndex = nextMilestoneIndex === -1 ? sortedMilestones.length - 1 : nextMilestoneIndex;

  return sortedMilestones.map((milestone, index) => {
    const threshold = Number(milestone.threshold_rows);
    const unlocked = acceptedRows >= threshold;

    return {
      threshold,
      tierLabel: milestone.tier_label,
      progress: threshold > 0 ? Math.min(100, Math.round((acceptedRows / threshold) * 100)) : 100,
      remainingRows: Math.max(0, threshold - acceptedRows),
      status: unlocked ? "unlocked" : index === currentMilestoneIndex ? "current" : "locked",
    };
  });
}

function taskerDisplayName(tasker: { display_name?: string | null; email?: string | null } | null | undefined, taskerId: string) {
  return tasker?.display_name ?? tasker?.email ?? `Tasker ${taskerId.slice(0, 8)}`;
}

function reviewerDisplayName(reviewer: { display_name?: string | null; email?: string | null } | null | undefined, reviewerId: string) {
  return reviewer?.display_name ?? reviewer?.email ?? `Reviewer ${reviewerId.slice(0, 8)}`;
}

async function getUserDisplayNames(
  supabase: SupabaseServerClient,
  userIds: string[],
  formatDisplayName: (user: { display_name?: string | null; email?: string | null } | null, userId: string) => string,
) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const displayNames = new Map<string, string>();

  if (!uniqueUserIds.length) {
    return displayNames;
  }

  const { data, error } = await supabase.from("users").select("id, display_name, email").in("id", uniqueUserIds);

  if (error) {
    uniqueUserIds.forEach((userId) => {
      displayNames.set(userId, formatDisplayName(null, userId));
    });

    return displayNames;
  }

  ((data ?? []) as { id: string; display_name: string | null; email: string | null }[]).forEach((user) => {
    displayNames.set(user.id, formatDisplayName(user, user.id));
  });

  uniqueUserIds.forEach((userId) => {
    if (!displayNames.has(userId)) {
      displayNames.set(userId, formatDisplayName(null, userId));
    }
  });

  return displayNames;
}

async function getTaskerStreakContexts(supabase: SupabaseServerClient, taskerIds: string[]) {
  const uniqueTaskerIds = Array.from(new Set(taskerIds));
  const contexts = new Map<
    string,
    {
      displayName: string;
      currentStreak: number;
      potentialStreak: number;
    }
  >();

  if (!uniqueTaskerIds.length) {
    return contexts;
  }

  const [{ data: taskers }, snapshots] = await Promise.all([
    supabase.from("users").select("id, display_name, email").in("id", uniqueTaskerIds),
    Promise.all(
      uniqueTaskerIds.map(async (taskerId) => {
        const [current, potential] = await Promise.all([
          getStreakSnapshot(supabase, taskerId, false),
          getStreakSnapshot(supabase, taskerId, true),
        ]);

        return {
          taskerId,
          current,
          potential,
        };
      }),
    ),
  ]);

  const taskerList = (taskers ?? []) as { id: string; display_name: string | null; email: string | null }[];

  snapshots.forEach(({ taskerId, current, potential }) => {
    const currentStreak = current.current_streak_days;
    const potentialStreak = Math.max(currentStreak, potential.current_streak_days);

    contexts.set(taskerId, {
      displayName: taskerDisplayName(
        taskerList.find((tasker) => tasker.id === taskerId),
        taskerId,
      ),
      currentStreak,
      potentialStreak,
    });
  });

  return contexts;
}

export async function getMyUserRow(auth0Sub: string): Promise<AppUserRow | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      id: "00000000-0000-0000-0000-000000000000",
      auth0_sub: auth0Sub,
      email: "local@example.com",
      display_name: "Local Preview",
      role: "tasker",
      admin_game_owner_id: null,
    };
  }

  const { data } = await supabase
    .from("users")
    .select("id, auth0_sub, email, display_name, role")
    .eq("auth0_sub", auth0Sub)
    .maybeSingle();

  return (data as AppUserRow | null) ?? null;
}

export async function getSprintPublicConfig(): Promise<SprintPublicConfig> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return fallbackConfig;
  }

  const { data } = await supabase.from("sprint_public_config").select("*").maybeSingle();
  return (data as SprintPublicConfig | null) ?? fallbackConfig;
}

export async function getTaskerDashboard(auth0Sub: string): Promise<TaskerDashboardData> {
  const [config, user] = await Promise.all([getSprintPublicConfig(), getMyUserRow(auth0Sub)]);
  const supabase = await createSupabaseServerClient();

  if (!supabase || !user) {
    const acceptedRows = 4;

    return {
      config,
      acceptedRows,
      pendingRows: 1,
      currentStreak: 2,
      longestStreak: 4,
      potentialStreak: 3,
      pendingStreakDelta: 1,
      milestonesUnlocked: 0,
      milestoneRoadmap: buildMilestoneRoadmap(fallbackMilestones, acceptedRows),
      totalEarnedCents: 12000,
      sourceBreakdown: { quality_bonus: 9000, streak_bonus: 3000 },
      submittedToday: false,
      submissionsToday: 0,
      maxDailySubmissions: MAX_PROBLEMS_PER_TASKER_PER_DAY,
      submittedRowSummaries: [
        {
          id: "local-preview-row",
          submitted_at: new Date().toISOString(),
          status: "pending_review",
          problemId: "local-preview-row",
          taskType: "Debugging",
          tokenCount: 3210,
          taigaProblemUrl: "https://taiga.example.com/project/live-compare/us/local-preview-row",
        },
      ],
      pendingRowSummaries: [],
      nextMilestone: { threshold: 5, tierLabel: "Tier 1", progress: 80 },
    };
  }

  const [{ data: rows }, { data: streak }, { data: achievements }, { data: earnings }, { data: milestones }] =
    await Promise.all([
      supabase.from("rows").select("id, status, submitted_at, metadata").eq("tasker_id", user.id).order("submitted_at", { ascending: false }),
      supabase.from("streaks").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("milestone_achievements").select("id").eq("user_id", user.id),
      supabase.from("earnings").select("source, amount_cents").eq("user_id", user.id),
      supabase.from("milestones").select("threshold_rows, tier_label").order("threshold_rows"),
    ]);

  const rowList = (rows ?? []) as TaskerDashboardRow[];
  const acceptedRows = rowList.filter((row) => acceptedStatuses.includes(row.status as (typeof acceptedStatuses)[number])).length;
  const pendingRows = rowList.filter((row) => row.status === "pending_review").length;
  const today = new Date().toISOString().slice(0, 10);
  const submissionsToday = rowList.filter((row) => row.submitted_at?.slice(0, 10) === today).length;
  const submittedToday = submissionsToday > 0;
  const currentStreak = Number((streak as { current_streak_days?: number } | null)?.current_streak_days ?? 0);
  const longestStreak = Number((streak as { longest_streak_days?: number } | null)?.longest_streak_days ?? 0);
  const potentialSnapshot = await getStreakSnapshot(supabase, user.id, true);
  const potentialStreak = Math.max(currentStreak, potentialSnapshot.current_streak_days);
  const submittedRowSummaries = rowList.map(buildSubmittedRowSummary);
  const pendingRowSummaries = submittedRowSummaries
    .filter((row) => row.status === "pending_review")
    .slice(0, MAX_PROBLEMS_PER_TASKER_PER_DAY);
  const earningRows = (earnings ?? []) as { source: string; amount_cents: number }[];
  const sourceBreakdown = earningRows.reduce<Record<string, number>>((acc, earning) => {
    acc[earning.source] = (acc[earning.source] ?? 0) + earning.amount_cents;
    return acc;
  }, {});
  const milestoneRows = (milestones ?? []) as { threshold_rows: number; tier_label: string }[];
  const next = milestoneRows.find(
    (milestone) => milestone.threshold_rows > acceptedRows,
  );

  return {
    config,
    acceptedRows,
    pendingRows,
    currentStreak,
    longestStreak,
    potentialStreak,
    pendingStreakDelta: Math.max(0, potentialStreak - currentStreak),
    milestonesUnlocked: (achievements ?? []).length,
    milestoneRoadmap: buildMilestoneRoadmap(milestoneRows, acceptedRows),
    totalEarnedCents: earningRows.reduce((sum, earning) => sum + earning.amount_cents, 0),
    sourceBreakdown,
    submittedToday,
    submissionsToday,
    maxDailySubmissions: MAX_PROBLEMS_PER_TASKER_PER_DAY,
    submittedRowSummaries,
    pendingRowSummaries,
    nextMilestone: next
      ? {
          threshold: next.threshold_rows,
          tierLabel: next.tier_label,
          progress: Math.min(100, Math.round((acceptedRows / next.threshold_rows) * 100)),
        }
      : null,
  };
}

export async function getLeaderboards() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      volume: [{ rank: 1, display_name: "Be the first", metric: "0 accepted rows" }],
      quality: [{ rank: 1, display_name: "Be the first", metric: "5-row minimum" }],
      consistency: [{ rank: 1, display_name: "Be the first", metric: "0 day streak" }],
    };
  }

  const [{ data: volume }, { data: quality }, { data: consistency }] = await Promise.all([
    supabase.from("leaderboard_volume_top5").select("*"),
    supabase.from("leaderboard_quality_top5").select("*"),
    supabase.from("leaderboard_consistency_top5").select("*"),
  ]);

  return {
    volume: ((volume ?? []) as { rank: number; display_name: string; accepted_rows: number }[]).map((entry) => ({
      rank: entry.rank,
      display_name: entry.display_name,
      metric: `${entry.accepted_rows} accepted`,
    })),
    quality: ((quality ?? []) as { rank: number; display_name: string; accepted_rows: number }[]).map((entry) => ({
      rank: entry.rank,
      display_name: entry.display_name,
      metric: `${entry.accepted_rows} accepted`,
    })),
    consistency: ((consistency ?? []) as { rank: number; display_name: string; current_streak_days: number }[]).map(
      (entry) => ({
        rank: entry.rank,
        display_name: entry.display_name,
        metric: `${entry.current_streak_days} days`,
      }),
    ),
  };
}

export async function getGuildData(auth0Sub: string): Promise<GuildData> {
  const user = await getMyUserRow(auth0Sub);
  const supabase = await createSupabaseServerClient();

  if (!supabase || !user) {
    return {
      myGuild: "Local Guild",
      roster: ["Local Preview", "Sprint Buddy"],
      standings: [{ rank: 1, name: "Local Guild", accepted_rows: 0 }],
    };
  }

  const [{ data: standings }, { data: memberships }] = await Promise.all([
    supabase.from("guild_standings_public").select("*"),
    supabase.from("guild_memberships").select("guild_id, guilds(name)").eq("user_id", user.id),
  ]);

  const firstMembership = (memberships?.[0] as { guild_id?: string; guilds?: { name?: string } } | undefined) ?? null;

  if (!firstMembership?.guild_id) {
    return {
      myGuild: null,
      roster: [],
      standings: (standings ?? []) as GuildData["standings"],
    };
  }

  const { data: rosterRows } = await supabase
    .from("guild_memberships")
    .select("users(display_name, email)")
    .eq("guild_id", firstMembership.guild_id);

  return {
    myGuild: firstMembership.guilds?.name ?? null,
    roster: ((rosterRows ?? []) as { users?: { display_name?: string; email?: string } }[]).map(
      (row) => row.users?.display_name ?? row.users?.email ?? "Tasker",
    ),
    standings: (standings ?? []) as GuildData["standings"],
  };
}

export async function getGoodies(auth0Sub: string) {
  const user = await getMyUserRow(auth0Sub);
  const supabase = await createSupabaseServerClient();

  if (!supabase || !user) {
    return {
      acceptedRows: 4,
      goodies: [] as Goodie[],
      achievements: [] as MilestoneAchievement[],
      milestones: [
        { id: 1, threshold_rows: 5, tier_label: "Tier 1" },
        { id: 2, threshold_rows: 10, tier_label: "Tier 2" },
        { id: 3, threshold_rows: 25, tier_label: "Tier 3" },
      ],
    };
  }

  const [{ data: rows }, { data: goodies }, { data: achievements }, { data: milestones }] = await Promise.all([
    supabase.from("rows").select("id").eq("tasker_id", user.id).in("status", acceptedStatuses),
    supabase.from("goodies").select("*").eq("available", true).order("tier_label"),
    supabase.from("milestone_achievements").select("*").eq("user_id", user.id),
    supabase.from("milestones").select("*").order("threshold_rows"),
  ]);

  return {
    acceptedRows: rows?.length ?? 0,
    goodies: (goodies ?? []) as Goodie[],
    achievements: (achievements ?? []) as MilestoneAchievement[],
    milestones: (milestones ?? []) as { id: number; threshold_rows: number; tier_label: string }[],
  };
}

export async function getEarnings(auth0Sub: string) {
  const user = await getMyUserRow(auth0Sub);
  const supabase = await createSupabaseServerClient();

  if (!supabase || !user) {
    return {
      totalCents: 12000,
      earnings: [] as Earning[],
    };
  }

  const { data } = await supabase
    .from("earnings")
    .select("id, source, amount_cents, awarded_at")
    .eq("user_id", user.id)
    .order("awarded_at", { ascending: false });

  const earnings = (data ?? []) as Earning[];

  return {
    totalCents: earnings.reduce((sum, earning) => sum + earning.amount_cents, 0),
    earnings,
  };
}

async function releaseExpiredReservations(supabase: SupabaseServerClient, now = new Date()) {
  const { error } = await supabase
    .from("rows")
    .update({ reserved_by: null, reserved_until: null })
    .eq("status", "pending_review")
    .lte("reserved_until", now.toISOString())
    .not("reserved_by", "is", null);

  if (error) {
    throw new Error(error.message);
  }
}

type RawReviewQueueRow = {
  id: string;
  tasker_id: string;
  submitted_at: string;
  reserved_by: string | null;
  reserved_until: string | null;
  metadata: Record<string, unknown>;
};

type RawReviewerDashboardRow = RawReviewQueueRow & {
  status: string;
  reviewer_id: string | null;
  reviewed_at: string | null;
};

export async function getReviewQueue(reviewerId?: string): Promise<ReviewQueueRow[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const now = new Date();
  await releaseExpiredReservations(supabase, now);

  const { data, error } = await supabase
    .from("rows")
    .select("id, tasker_id, submitted_at, reserved_by, reserved_until, metadata")
    .eq("status", "pending_review")
    .order("submitted_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data ?? []) as RawReviewQueueRow[]).filter(
    (row) => !isReviewReservationActive(row.reserved_until, now) || row.reserved_by === reviewerId,
  );
  const contexts = await getTaskerStreakContexts(
    supabase,
    rows.map((row) => row.tasker_id),
  );

  return rows.map((row) => {
    const context = contexts.get(row.tasker_id);

    return {
      ...row,
      tasker_display_name: context?.displayName ?? `Tasker ${row.tasker_id.slice(0, 8)}`,
      tasker_current_streak_days: context?.currentStreak ?? 0,
      tasker_potential_streak_days: context?.potentialStreak ?? 0,
    };
  });
}

function buildReviewerDashboardRow({
  row,
  taskerContexts,
  taskerDisplayNames,
  reviewerDisplayNames,
}: {
  row: RawReviewerDashboardRow;
  taskerContexts: Awaited<ReturnType<typeof getTaskerStreakContexts>>;
  taskerDisplayNames: Map<string, string>;
  reviewerDisplayNames: Map<string, string>;
}): ReviewerDashboardRow {
  const taskerContext = taskerContexts.get(row.tasker_id);

  return {
    ...row,
    tasker_display_name: taskerContext?.displayName ?? taskerDisplayNames.get(row.tasker_id) ?? taskerDisplayName(null, row.tasker_id),
    tasker_current_streak_days: taskerContext?.currentStreak ?? 0,
    tasker_potential_streak_days: taskerContext?.potentialStreak ?? taskerContext?.currentStreak ?? 0,
    reserved_by_display_name: row.reserved_by ? (reviewerDisplayNames.get(row.reserved_by) ?? reviewerDisplayName(null, row.reserved_by)) : null,
    reviewer_display_name: row.reviewer_id ? (reviewerDisplayNames.get(row.reviewer_id) ?? reviewerDisplayName(null, row.reviewer_id)) : null,
  };
}

export async function getReviewerDashboard(): Promise<ReviewerDashboardData> {
  const emptyDashboard = {
    availableRows: [],
    reservedRows: [],
    reviewedRows: [],
  };
  const supabase = await createSupabaseServerClient().catch(() => null);

  if (!supabase) {
    return emptyDashboard;
  }

  const now = new Date();

  try {
    await releaseExpiredReservations(supabase, now);
  } catch {
    // The dashboard can still render by treating expired holds as available below.
  }

  let pendingResult;
  let reviewedResult;

  try {
    [pendingResult, reviewedResult] = await Promise.all([
      supabase
        .from("rows")
        .select("id, tasker_id, submitted_at, status, reserved_by, reserved_until, reviewer_id, reviewed_at, metadata")
        .eq("status", "pending_review")
        .order("submitted_at", { ascending: true }),
      supabase
        .from("rows")
        .select("id, tasker_id, submitted_at, status, reserved_by, reserved_until, reviewer_id, reviewed_at, metadata")
        .in("status", ["accepted_clean", "rejected"])
        .order("reviewed_at", { ascending: false }),
    ]);
  } catch {
    return emptyDashboard;
  }

  const pendingRows = pendingResult.error ? [] : ((pendingResult.data ?? []) as RawReviewerDashboardRow[]);
  const reviewedRows = reviewedResult.error ? [] : ((reviewedResult.data ?? []) as RawReviewerDashboardRow[]);
  const pendingTaskerContexts = await getTaskerStreakContexts(
    supabase,
    pendingRows.map((row) => row.tasker_id),
  ).catch(() => new Map());
  const [reviewedTaskerDisplayNames, reviewerDisplayNames] = await Promise.all([
    getUserDisplayNames(
      supabase,
      reviewedRows.map((row) => row.tasker_id),
      taskerDisplayName,
    ),
    getUserDisplayNames(
      supabase,
      [
        ...pendingRows.map((row) => row.reserved_by).filter((userId): userId is string => Boolean(userId)),
        ...reviewedRows.map((row) => row.reviewer_id).filter((userId): userId is string => Boolean(userId)),
      ],
      reviewerDisplayName,
    ),
  ]).catch(() => [new Map<string, string>(), new Map<string, string>()]);

  const availableRows = pendingRows
    .filter((row) => !isReviewReservationActive(row.reserved_until, now))
    .map((row) =>
      buildReviewerDashboardRow({
        row,
        taskerContexts: pendingTaskerContexts,
        taskerDisplayNames: reviewedTaskerDisplayNames,
        reviewerDisplayNames,
      }),
    );
  const reservedRows = pendingRows
    .filter((row) => isReviewReservationActive(row.reserved_until, now))
    .map((row) =>
      buildReviewerDashboardRow({
        row,
        taskerContexts: pendingTaskerContexts,
        taskerDisplayNames: reviewedTaskerDisplayNames,
        reviewerDisplayNames,
      }),
    );
  const hydratedReviewedRows = reviewedRows.map((row) =>
    buildReviewerDashboardRow({
      row,
      taskerContexts: new Map(),
      taskerDisplayNames: reviewedTaskerDisplayNames,
      reviewerDisplayNames,
    }),
  );

  return {
    availableRows,
    reservedRows,
    reviewedRows: hydratedReviewedRows,
  };
}

export async function getReviewDetail(rowId: string, reviewerId: string): Promise<ReviewDetail | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const now = new Date();

  try {
    await releaseExpiredReservations(supabase, now);
  } catch {
    // Detail access is validated below; cleanup failure should not hide active reviews.
  }

  const { data, error } = await supabase
    .from("rows")
    .select("id, tasker_id, submitted_at, status, reserved_by, reserved_until, metadata")
    .eq("id", rowId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as (RawReviewQueueRow & { status: string }) | null;

  if (
    !row ||
    row.status !== "pending_review" ||
    row.reserved_by !== reviewerId ||
    !isReviewReservationActive(row.reserved_until, now)
  ) {
    return null;
  }

  const contexts = await getTaskerStreakContexts(supabase, [row.tasker_id]).catch(() => new Map());
  const context = contexts.get(row.tasker_id);

  return {
    ...row,
    tasker_display_name: context?.displayName ?? `Tasker ${row.tasker_id.slice(0, 8)}`,
    tasker_current_streak_days: context?.currentStreak ?? 0,
    tasker_potential_streak_days: context?.potentialStreak ?? 0,
  };
}

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      acceptedRows: 0,
      targetRows: 1000,
      budgetCents: 0,
      revenueCents: 0,
      spendCents: 0,
      grossMarginPercent: 0,
      sourceSpend: [],
      burndown: [],
    };
  }

  const [{ data: rows }, { data: earnings }, { data: config }, { data: economics }] = await Promise.all([
    supabase.from("rows").select("submitted_at, status"),
    supabase.from("earnings").select("source, amount_cents"),
    supabase.from("sprint_config").select("*").eq("id", 1).maybeSingle(),
    supabase.from("program_economics").select("*").eq("id", 1).maybeSingle(),
  ]);

  const acceptedRows = ((rows ?? []) as { status: string }[]).filter((row) =>
    acceptedStatuses.includes(row.status as (typeof acceptedStatuses)[number]),
  ).length;
  const earningRows = (earnings ?? []) as { source: string; amount_cents: number }[];
  const spendCents = earningRows.reduce((sum, earning) => sum + earning.amount_cents, 0);
  const revenueCents = Number((economics as { revenue_cents?: number } | null)?.revenue_cents ?? 0);
  const sourceMap = earningRows.reduce<Record<string, number>>((acc, earning) => {
    acc[earning.source] = (acc[earning.source] ?? 0) + earning.amount_cents;
    return acc;
  }, {});

  return {
    acceptedRows,
    targetRows: Number((config as { collective_goal_rows?: number } | null)?.collective_goal_rows ?? 1000),
    budgetCents: Number((economics as { budget_cents?: number } | null)?.budget_cents ?? 0),
    revenueCents,
    spendCents,
    grossMarginPercent: revenueCents > 0 ? Math.round(((revenueCents - spendCents) / revenueCents) * 1000) / 10 : 0,
    sourceSpend: Object.entries(sourceMap).map(([source, amount_cents]) => ({ source, amount_cents })),
    burndown: [
      { day: "Start", accepted: 0, target: 0 },
      { day: "Today", accepted: acceptedRows, target: Number((config as { collective_goal_rows?: number } | null)?.collective_goal_rows ?? 1000) },
    ],
  };
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatSource(source: string) {
  return source
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}
