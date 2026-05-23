import { AppShell } from "@/components/app/app-shell";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin");

  return (
    <AppShell role={user.role} name={user.name ?? user.email ?? "Admin"}>
      {children}
    </AppShell>
  );
}
