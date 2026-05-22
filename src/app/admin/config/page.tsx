import { updateSprintConfig } from "@/app/actions";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldHelpLabel } from "@/components/ui/field-help-label";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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
  };

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
