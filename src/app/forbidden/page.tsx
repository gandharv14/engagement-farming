import { redirect } from "next/navigation";

import { getCurrentUser, getHomePathForRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ForbiddenPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  redirect(getHomePathForRole(user.role));
}
