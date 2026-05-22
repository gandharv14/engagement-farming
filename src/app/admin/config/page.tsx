import { updateSprintConfig } from "@/app/actions";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldHelpLabel } from "@/components/ui/field-help-label";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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

export default async function AdminConfigPage() {
  const user = await requireRole("admin");
  const supabase = await createSupabaseServerClient();
  const { data: config } = supabase
    ? await supabase.from("sprint_config").select("*").eq("id", 1).maybeSingle()
    : { data: null };
  const sprintConfig = (config ?? {}) as {
    current_phase?: string;
    quality_multiplier?: number;
    endgame_bounty_active?: boolean;
    endgame_bounty_amount_cents?: number;
    sprint_start_date?: string;
    sprint_end_date?: string;
  };
  const fallbackStartDate = formatDateInput(new Date());
  const fallbackEndDate = formatDateInput(addDays(new Date(`${fallbackStartDate}T00:00:00.000Z`), 11));
  const sprintStartDate = sprintConfig.sprint_start_date ?? fallbackStartDate;
  const sprintEndDate = sprintConfig.sprint_end_date ?? fallbackEndDate;
  const currentDurationDays = sprintDurationDays(sprintStartDate, sprintEndDate);

  return (
    <AppShell role={user.role} name={user.name ?? user.email ?? "Admin"}>
      <Card>
        <CardHeader>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-pink">Sprint Tuning</p>
          <CardTitle>Sprint Config</CardTitle>
          <CardDescription>Admin-managed incentives and phase controls.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateSprintConfig} className="grid gap-4 md:max-w-xl">
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
                  definition="The final calendar day included in the sprint. Leave duration blank to save this date directly."
                />
                <Input id="sprintEndDate" name="sprintEndDate" type="date" defaultValue={sprintEndDate} required />
              </div>
              <div className="grid gap-2">
                <FieldHelpLabel
                  htmlFor="sprintDurationDays"
                  label="Duration override, days"
                  definition="Optional. Enter a duration to recalculate the end date from the start date. Leave blank when editing the end date directly."
                />
                <Input id="sprintDurationDays" name="sprintDurationDays" type="number" min="1" placeholder={`${currentDurationDays}`} />
                <p className="text-xs text-muted-foreground">Current duration: {currentDurationDays} days.</p>
              </div>
            </div>
            <div className="grid gap-2">
              <FieldHelpLabel
                htmlFor="currentPhase"
                label="Current phase"
                definition="The active sprint phase shown to taskers. Warmup, steady, and finale can be used to communicate where the sprint is in its incentive cycle."
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
        </CardContent>
      </Card>
    </AppShell>
  );
}
