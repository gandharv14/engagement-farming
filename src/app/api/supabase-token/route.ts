import { auth0 } from "@/lib/auth0";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireRole(["tasker", "reviewer", "admin"]);
  const { token, expiresAt } = await auth0.getAccessToken();

  return Response.json({ token, expiresAt });
}
