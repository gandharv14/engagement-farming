import { selectGoodie } from "@/app/actions";
import { AppShell } from "@/components/app/app-shell";
import { RealtimeRefresh } from "@/components/app/realtime-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getTaskerShellProps, requireTaskerGameContext } from "@/lib/admin-game-mode";
import { getGoodies } from "@/lib/data";

export const dynamic = "force-dynamic";

const roughGoodieValues: Record<string, string> = {
  "Tier 1": "$50",
  "Tier 2": "$100",
  "Tier 3": "$200",
};

export default async function GoodiesPage() {
  const context = await requireTaskerGameContext();
  const data = await getGoodies(context.tasker.auth0_sub);

  return (
    <AppShell {...getTaskerShellProps(context)}>
      <RealtimeRefresh subscriptions={[{ table: "milestone_achievements" }, { table: "goodies" }]} />
      <div className="space-y-6">
        <div className="arena-panel rounded-3xl p-5">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-gold">Loot Unlocks</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Goodie Catalog</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Unlock one selection per tier. Rough values are shown here; internal costs stay admin-only.
          </p>
        </div>

        {data.milestones.map((milestone) => {
          const unlocked = data.acceptedRows >= milestone.threshold_rows;
          const achievement = data.achievements.find((item) => item.milestone_id === milestone.id);
          const tierGoodies = data.goodies.filter((goodie) => goodie.tier_label === milestone.tier_label);

          return (
            <section key={milestone.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-xl font-semibold text-arena-cyan">{milestone.tier_label}</h2>
                <Badge variant={unlocked ? "default" : "secondary"}>
                  {unlocked ? "Unlocked" : `Unlock at row #${milestone.threshold_rows}`}
                </Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {tierGoodies.length ? (
                  tierGoodies.map((goodie) => {
                    const selected = achievement?.goodie_id === goodie.id;
                    const roughValue = roughGoodieValues[goodie.tier_label];

                    return (
                      <Card key={goodie.id} className={unlocked ? "h-full" : "h-full opacity-60 grayscale"}>
                        <CardHeader>
                          <CardTitle>{goodie.name}</CardTitle>
                          {roughValue ? <Badge variant="outline">About {roughValue} value</Badge> : null}
                          <CardDescription>{goodie.description}</CardDescription>
                        </CardHeader>
                        <CardFooter className="mt-auto">
                          {selected ? (
                            <Badge>On the way</Badge>
                          ) : unlocked && achievement ? (
                            <form action={selectGoodie.bind(null, achievement.id, goodie.id)} className="w-full">
                              <Button type="submit" className="w-full" aria-label={`Select ${goodie.name}`}>
                                Select this goodie
                              </Button>
                            </form>
                          ) : (
                            <Button disabled className="w-full" variant="secondary">
                              Locked
                            </Button>
                          )}
                        </CardFooter>
                      </Card>
                    );
                  })
                ) : (
                  <Card>
                    <CardContent className="p-6 text-sm text-muted-foreground">
                      Catalog items for this tier appear here once admins add them.
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
