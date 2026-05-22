import { requireRole } from "@/lib/auth";
import { buildPayoutsCsv, type PayoutEarningRow } from "@/lib/payouts";
import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireRole("admin");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return new Response("Supabase is not configured.", { status: 500 });
  }

  const { data } = await supabase
    .from("earnings")
    .select("user_id, amount_cents, users(email, display_name)")
    .order("user_id");

  const csv = buildPayoutsCsv((data ?? []) as PayoutEarningRow[]);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="payouts.csv"',
    },
  });
}
