import { auth0, getAuth0AccessTokenOptions } from "@/lib/auth0";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireRole(["tasker", "reviewer", "admin"]);

  try {
    const { token, expiresAt } = await auth0.getAccessToken(getAuth0AccessTokenOptions());

    return Response.json({ token, expiresAt });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "missing_session") {
      return new Response(null, { status: 401 });
    }

    throw error;
  }
}
