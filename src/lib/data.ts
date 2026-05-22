import { createSupabaseServerClient } from "@/lib/supabase";

export const acceptedStatuses = ["accepted_clean", "accepted_with_edits"] as const;

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
  milestonesUnlocked: number;
  totalEarnedCents: number;
  sourceBreakdown: Record<string, number>;
  submittedToday: boolean;
  nextMilestone: {
    threshold: number;
    tierLabel: string;
    progress: number;
  } | null;
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
  image_url: string | null;
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
  submitted_at: string;
  metadata: Record<string, unknown>;
};

export type ReviewDetail = ReviewQueueRow & {
  status: string;
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
    return {
      config,
      acceptedRows: 4,
      pendingRows: 1,
      currentStreak: 2,
      longestStreak: 4,
      milestonesUnlocked: 0,
      totalEarnedCents: 12000,
      sourceBreakdown: { quality_bonus: 9000, streak_bonus: 3000 },
      submittedToday: false,
      nextMilestone: { threshold: 5, tierLabel: "Tier 1", progress: 80 },
    };
  }

  const [{ data: rows }, { data: streak }, { data: achievements }, { data: earnings }, { data: milestones }] =
    await Promise.all([
      supabase.from("rows").select("status, submitted_at").eq("tasker_id", user.id),
      supabase.from("streaks").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("milestone_achievements").select("id").eq("user_id", user.id),
      supabase.from("earnings").select("source, amount_cents").eq("user_id", user.id),
      supabase.from("milestones").select("threshold_rows, tier_label").order("threshold_rows"),
    ]);

  const rowList = (rows ?? []) as { status: string; submitted_at: string }[];
  const acceptedRows = rowList.filter((row) => acceptedStatuses.includes(row.status as (typeof acceptedStatuses)[number])).length;
  const pendingRows = rowList.filter((row) => row.status === "pending_review").length;
  const today = new Date().toISOString().slice(0, 10);
  const submittedToday = rowList.some((row) => row.submitted_at?.slice(0, 10) === today);
  const earningRows = (earnings ?? []) as { source: string; amount_cents: number }[];
  const sourceBreakdown = earningRows.reduce<Record<string, number>>((acc, earning) => {
    acc[earning.source] = (acc[earning.source] ?? 0) + earning.amount_cents;
    return acc;
  }, {});
  const next = ((milestones ?? []) as { threshold_rows: number; tier_label: string }[]).find(
    (milestone) => milestone.threshold_rows > acceptedRows,
  );

  return {
    config,
    acceptedRows,
    pendingRows,
    currentStreak: Number((streak as { current_streak_days?: number } | null)?.current_streak_days ?? 0),
    longestStreak: Number((streak as { longest_streak_days?: number } | null)?.longest_streak_days ?? 0),
    milestonesUnlocked: (achievements ?? []).length,
    totalEarnedCents: earningRows.reduce((sum, earning) => sum + earning.amount_cents, 0),
    sourceBreakdown,
    submittedToday,
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
    quality: ((quality ?? []) as { rank: number; display_name: string; average_score: number }[]).map((entry) => ({
      rank: entry.rank,
      display_name: entry.display_name,
      metric: `${entry.average_score}/5 avg`,
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

export async function getReviewQueue(): Promise<ReviewQueueRow[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data } = await supabase
    .from("rows")
    .select("id, submitted_at, metadata")
    .eq("status", "pending_review")
    .order("submitted_at", { ascending: true });

  return (data ?? []) as ReviewQueueRow[];
}

export async function getReviewDetail(rowId: string): Promise<ReviewDetail | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("rows")
    .select("id, submitted_at, status, metadata")
    .eq("id", rowId)
    .maybeSingle();

  return (data as ReviewDetail | null) ?? null;
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
