import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function csvEscape(value: string | number) {
  const stringValue = String(value);
  return `"${stringValue.replaceAll('"', '""')}"`;
}

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

  const grouped = new Map<string, { email: string; displayName: string; cents: number }>();

  ((data ?? []) as { user_id: string; amount_cents: number; users?: { email?: string; display_name?: string } }[]).forEach((row) => {
    const current = grouped.get(row.user_id) ?? {
      email: row.users?.email ?? "",
      displayName: row.users?.display_name ?? "",
      cents: 0,
    };

    current.cents += row.amount_cents;
    grouped.set(row.user_id, current);
  });

  const csv = [
    ["user_id", "email", "display_name", "amount_cents"].map(csvEscape).join(","),
    ...Array.from(grouped.entries()).map(([userId, row]) =>
      [userId, row.email, row.displayName, row.cents].map(csvEscape).join(","),
    ),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="payouts.csv"',
    },
  });
}
