import { updateSprintConfig } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldHelpLabel } from "@/components/ui/field-help-label";
import { Input } from "@/components/ui/input";
import {
  MAX_PROBLEMS_PER_TASKER_PER_DAY,
  TOKENS_PER_PROBLEM,
  getCollectiveProblemCapacity,
  getMaxProblemsPerTasker,
} from "@/lib/sprint-config";
import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type AdminConfigSearchParams = {
  saved?: string;
  warning?: string | string[];
  error?: string;
};

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function sprintDurationDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const durationMs = end.getTime() - start.getTime();

  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return 1;
  }

  return Math.floor(durationMs / 86_400_000) + 1;
}

export default async function AdminConfigPage({ searchParams }: { searchParams?: Promise<AdminConfigSearchParams> }) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const supabase = await createSupabaseServerClient();
  const { data: config } = supabase
    ? await supabase.from("sprint_config").select("*").eq("id", 1).maybeSingle()
    : { data: null };
  const { data: milestones } = supabase ? await supabase.from("milestones").select("*").order("id") : { data: null };
  const { count: taskerCount } = supabase
    ? await supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "tasker").is("admin_game_owner_id", null)
    : { count: 0 };
  const sprintConfig = (config ?? {}) as {
    current_phase?: string;
    quality_multiplier?: number;
    endgame_bounty_active?: boolean;
    endgame_bounty_amount_cents?: number;
    sprint_start_date?: string;
    sprint_end_date?: string;
    collective_goal_rows?: number;
    collective_stretch_rows?: number;
  };
  const milestoneList = (milestones ?? []) as { id: number; threshold_rows: number; tier_label: string }[];
  const milestoneById = new Map(milestoneList.map((milestone) => [milestone.id, milestone]));
  const fallbackStartDate = formatDateInput(new Date());
  const fallbackEndDate = formatDateInput(addDays(new Date(`${fallbackStartDate}T00:00:00.000Z`), 11));
  const sprintStartDate = sprintConfig.sprint_start_date ?? fallbackStartDate;
  const sprintEndDate = sprintConfig.sprint_end_date ?? fallbackEndDate;
  const currentDurationDays = sprintDurationDays(sprintStartDate, sprintEndDate);
  const realTaskerCount = taskerCount ?? 0;
  const maxProblemsPerTasker = getMaxProblemsPerTasker(currentDurationDays);
  const collectiveCapacity = getCollectiveProblemCapacity(currentDurationDays, realTaskerCount);
  const perTaskerTokens = maxProblemsPerTasker * TOKENS_PER_PROBLEM;
  const collectiveGoalRows = sprintConfig.collective_goal_rows ?? 1000;
  const collectiveStretchRows = sprintConfig.collective_stretch_rows ?? 2000;
  const requiredGoalTaskers = Math.ceil(collectiveGoalRows / (currentDurationDays * MAX_PROBLEMS_PER_TASKER_PER_DAY));
  const requiredStretchTaskers = Math.ceil(collectiveStretchRows / (currentDurationDays * MAX_PROBLEMS_PER_TASKER_PER_DAY));
  const warnings = Array.isArray(resolvedSearchParams.warning)
    ? resolvedSearchParams.warning
    : resolvedSearchParams.warning
      ? [resolvedSearchParams.warning]
      : [];

  return (
    <Card>
        <CardHeader>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-pink">Sprint Tuning</p>
          <CardTitle>Sprint Config</CardTitle>
          <CardDescription>Admin-managed incentives and phase controls.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:max-w-3xl">
            {resolvedSearchParams.error ? (
              <Alert variant="destructive">
                <AlertTitle>Config was not saved</AlertTitle>
                <AlertDescription>{resolvedSearchParams.error}</AlertDescription>
              </Alert>
            ) : null}

            {resolvedSearchParams.saved && warnings.length === 0 ? (
              <Alert>
                <AlertTitle>Config saved</AlertTitle>
                <AlertDescription>The current sprint settings were saved successfully.</AlertDescription>
              </Alert>
            ) : null}

            {resolvedSearchParams.saved && warnings.length > 0 ? (
              <Alert>
                <AlertTitle>Config saved with warnings</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-5">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}

            <form action={updateSprintConfig} className="grid gap-6">
              <div className="grid gap-4 rounded-2xl border border-arena-gold/25 bg-arena-gold/10 p-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-arena-gold">Fixed Game Rules</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    One tasker can submit at most {MAX_PROBLEMS_PER_TASKER_PER_DAY} problems per day. Each problem is{" "}
                    {TOKENS_PER_PROBLEM.toLocaleString()} tokens.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-arena-cyan/20 bg-background/60 p-3">
                    <p className="text-xs text-muted-foreground">Real taskers</p>
                    <p className="font-mono text-2xl text-arena-cyan">{realTaskerCount.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-arena-cyan/20 bg-background/60 p-3">
                    <p className="text-xs text-muted-foreground">Max per tasker this sprint</p>
                    <p className="font-mono text-2xl text-arena-cyan">{maxProblemsPerTasker.toLocaleString()} problems</p>
                    <p className="text-xs text-muted-foreground">{perTaskerTokens.toLocaleString()} tokens</p>
                  </div>
                  <div className="rounded-xl border border-arena-cyan/20 bg-background/60 p-3">
                    <p className="text-xs text-muted-foreground">Roster capacity</p>
                    <p className="font-mono text-2xl text-arena-cyan">{collectiveCapacity.toLocaleString()} problems</p>
                  </div>
                  <div className="rounded-xl border border-arena-cyan/20 bg-background/60 p-3">
                    <p className="text-xs text-muted-foreground">Taskers needed now</p>
                    <p className="font-mono text-2xl text-arena-cyan">{requiredGoalTaskers.toLocaleString()} goal</p>
                    <p className="text-xs text-muted-foreground">{requiredStretchTaskers.toLocaleString()} for stretch</p>
                  </div>
                </div>
                <div className="grid gap-2 rounded-xl border border-arena-gold/20 bg-background/60 p-3 text-xs text-muted-foreground">
                  <p className="font-mono uppercase tracking-[0.18em] text-arena-gold">Formulas</p>
                  <p>
                    Max per tasker = sprint days x daily cap = {currentDurationDays.toLocaleString()} x{" "}
                    {MAX_PROBLEMS_PER_TASKER_PER_DAY.toLocaleString()} = {maxProblemsPerTasker.toLocaleString()} problems.
                  </p>
                  <p>
                    Per-tasker tokens = max per tasker x tokens per problem = {maxProblemsPerTasker.toLocaleString()} x{" "}
                    {TOKENS_PER_PROBLEM.toLocaleString()} = {perTaskerTokens.toLocaleString()} tokens.
                  </p>
                  <p>
                    Roster capacity = real taskers x max per tasker = {realTaskerCount.toLocaleString()} x{" "}
                    {maxProblemsPerTasker.toLocaleString()} = {collectiveCapacity.toLocaleString()} problems.
                  </p>
                  <p>
                    Taskers needed = ceiling(target rows / max per tasker): goal {requiredGoalTaskers.toLocaleString()}, stretch{" "}
                    {requiredStretchTaskers.toLocaleString()}.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Impossible targets are saved with warnings so admins can stage draft rules, recruit more taskers, or adjust the sprint later.
                </p>
              </div>

            <div className="grid gap-4 rounded-2xl border border-arena-cyan/20 bg-arena-cyan/5 p-4">
              <div className="grid gap-2">
                <FieldHelpLabel
                  htmlFor="sprintStartDate"
                  label="Sprint start date"
                  definition="The first calendar day counted as day 1 of the sprint. Tasker dashboards calculate the current sprint day from this value."
                />
                <Input id="sprintStartDate" name="sprintStartDate" type="date" defaultValue={sprintStartDate} required />
              </div>
              <div className="grid gap-2">
                <FieldHelpLabel
                  htmlFor="sprintEndDate"
                  label="Sprint end date"
                  definition="The final calendar day included in the sprint. The app calculates the duration from the start and end dates."
                />
                <Input id="sprintEndDate" name="sprintEndDate" type="date" defaultValue={sprintEndDate} required />
                <p className="text-xs text-muted-foreground">Current duration: {currentDurationDays} days.</p>
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-arena-purple/20 bg-arena-purple/10 p-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-arena-purple">Collective Challenge</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Goals are checked against the current tasker roster, sprint length, and {MAX_PROBLEMS_PER_TASKER_PER_DAY}-problem daily cap.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <FieldHelpLabel
                    htmlFor="collectiveGoalRows"
                    label="Collective goal rows"
                    definition="Primary accepted-problem target for the whole sprint. The app warns if it exceeds the roster's maximum possible output."
                  />
                  <Input
                    id="collectiveGoalRows"
                    name="collectiveGoalRows"
                    type="number"
                    min="1"
                    defaultValue={collectiveGoalRows}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <FieldHelpLabel
                    htmlFor="collectiveStretchRows"
                    label="Collective stretch rows"
                    definition="Stretch accepted-problem target. The app warns if it exceeds roster capacity."
                  />
                  <Input
                    id="collectiveStretchRows"
                    name="collectiveStretchRows"
                    type="number"
                    min="1"
                    defaultValue={collectiveStretchRows}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2 rounded-xl border border-arena-purple/20 bg-background/60 p-3 text-xs text-muted-foreground">
                <p className="font-mono uppercase tracking-[0.18em] text-arena-purple">Warning formulas</p>
                <p>
                  Capacity warning when target rows &gt; roster capacity. Current roster capacity is{" "}
                  {collectiveCapacity.toLocaleString()} problems.
                </p>
                <p>
                  Goal uses {collectiveGoalRows.toLocaleString()} &gt; {collectiveCapacity.toLocaleString()}; stretch uses{" "}
                  {collectiveStretchRows.toLocaleString()} &gt; {collectiveCapacity.toLocaleString()}.
                </p>
                <p>Roster warning when real taskers &lt; 1. Current real taskers: {realTaskerCount.toLocaleString()}.</p>
                <p>Stretch below goal is a save error, not a warning: stretch must be greater than or equal to goal.</p>
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-arena-gold/25 bg-arena-gold/10 p-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-arena-gold">Goodie Milestones</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The app warns when a tier is unreachable by one player. With the current duration, the maximum is {maxProblemsPerTasker} accepted
                  rows.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <FieldHelpLabel
                    htmlFor="tier1ThresholdRows"
                    label="Tier 1 threshold"
                    definition="Accepted rows required to unlock the first goodie tier."
                  />
                  <Input
                    id="tier1ThresholdRows"
                    name="tier1ThresholdRows"
                    type="number"
                    min="1"
                    defaultValue={milestoneById.get(1)?.threshold_rows ?? 5}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <FieldHelpLabel
                    htmlFor="tier2ThresholdRows"
                    label="Tier 2 threshold"
                    definition="Accepted rows required to unlock the second goodie tier."
                  />
                  <Input
                    id="tier2ThresholdRows"
                    name="tier2ThresholdRows"
                    type="number"
                    min="1"
                    defaultValue={milestoneById.get(2)?.threshold_rows ?? 10}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <FieldHelpLabel
                    htmlFor="tier3ThresholdRows"
                    label="Tier 3 threshold"
                    definition={`Accepted rows required to unlock the final goodie tier. With the current duration, one player can complete at most ${maxProblemsPerTasker} rows.`}
                  />
                  <Input
                    id="tier3ThresholdRows"
                    name="tier3ThresholdRows"
                    type="number"
                    min="1"
                    defaultValue={milestoneById.get(3)?.threshold_rows ?? 25}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2 rounded-xl border border-arena-gold/20 bg-background/60 p-3 text-xs text-muted-foreground">
                <p className="font-mono uppercase tracking-[0.18em] text-arena-gold">Warning formulas</p>
                <p>Reachability warning when tier threshold &gt; max per tasker ({maxProblemsPerTasker.toLocaleString()} rows).</p>
                <p>Ordering warning when any tier threshold is less than or equal to the previous tier threshold.</p>
                <p>Duplicate tier thresholds are a save error because each milestone threshold must be unique.</p>
              </div>
            </div>

            <div className="grid gap-2">
              <FieldHelpLabel
                htmlFor="currentPhase"
                label="Current phase"
                definition="The active sprint phase shown to taskers. Use Ended to close submissions and show the sprint-ended message."
              />
              <select
                id="currentPhase"
                name="currentPhase"
                defaultValue={sprintConfig.current_phase ?? "warmup"}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="warmup">Warmup</option>
                <option value="steady">Steady</option>
                <option value="finale">Finale</option>
                <option value="ended">Ended</option>
              </select>
            </div>
            <div className="grid gap-2">
              <FieldHelpLabel
                htmlFor="qualityMultiplier"
                label="Quality multiplier"
                definition="Multiplier displayed on the tasker dashboard for quality-based incentives. Use 1 for the normal baseline, or a higher decimal value when quality rewards are boosted."
              />
              <Input id="qualityMultiplier" name="qualityMultiplier" type="number" step="0.1" defaultValue={sprintConfig.quality_multiplier ?? 1} />
            </div>
            <div className="grid gap-2">
              <FieldHelpLabel
                htmlFor="endgameBountyAmountCents"
                label="Endgame bounty amount, cents"
                definition="Per-bounty amount for the finale incentive, entered in cents. This value is stored with sprint config and pairs with the endgame bounty active toggle."
              />
              <Input
                id="endgameBountyAmountCents"
                name="endgameBountyAmountCents"
                type="number"
                min="0"
                defaultValue={sprintConfig.endgame_bounty_amount_cents ?? 0}
              />
            </div>
            <div className="grid gap-2">
              <FieldHelpLabel
                htmlFor="endgameBountyActive"
                label="Endgame bounty active"
                definition="Turns on the finale bounty indicator for taskers. When enabled, the dashboard highlights that the endgame bounty is active."
              />
              <label className="flex items-center gap-2 rounded-2xl border border-arena-cyan/20 bg-arena-cyan/5 p-3 text-sm">
                <input
                  id="endgameBountyActive"
                  name="endgameBountyActive"
                  type="checkbox"
                  defaultChecked={sprintConfig.endgame_bounty_active ?? false}
                />
                Active
              </label>
            </div>
            <Button type="submit">Save config</Button>
          </form>
          </div>
        </CardContent>
      </Card>
  );
}
