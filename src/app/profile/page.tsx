import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireRole("tasker");

  return (
    <AppShell role={user.role} name={user.name ?? user.email ?? "Tasker"}>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Account information from Auth0.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between rounded-xl border p-3">
            <span className="text-muted-foreground">Name</span>
            <span>{user.name ?? "Not set"}</span>
          </div>
          <div className="flex justify-between rounded-xl border p-3">
            <span className="text-muted-foreground">Email</span>
            <span>{user.email ?? "Not set"}</span>
          </div>
          <div className="flex justify-between rounded-xl border p-3">
            <span className="text-muted-foreground">Role</span>
            <span className="capitalize">{user.role}</span>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
