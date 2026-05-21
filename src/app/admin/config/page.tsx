import { updateSprintConfig } from "@/app/actions";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
          <CardTitle>Sprint Config</CardTitle>
          <CardDescription>Admin-managed incentives and phase controls.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateSprintConfig} className="grid gap-4 md:max-w-xl">
            <div className="grid gap-2">
              <Label htmlFor="currentPhase">Current phase</Label>
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
              <Label htmlFor="qualityMultiplier">Quality multiplier</Label>
              <Input id="qualityMultiplier" name="qualityMultiplier" type="number" step="0.1" defaultValue={sprintConfig.quality_multiplier ?? 1} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endgameBountyAmountCents">Endgame bounty amount, cents</Label>
              <Input
                id="endgameBountyAmountCents"
                name="endgameBountyAmountCents"
                type="number"
                min="0"
                defaultValue={sprintConfig.endgame_bounty_amount_cents ?? 0}
              />
            </div>
            <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
              <input name="endgameBountyActive" type="checkbox" defaultChecked={sprintConfig.endgame_bounty_active ?? false} />
              Endgame bounty active
            </label>
            <Button type="submit">Save config</Button>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
