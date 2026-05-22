export type PayoutEarningRow = {
  user_id: string;
  amount_cents: number;
  users?: {
    email?: string | null;
    display_name?: string | null;
  } | null;
};

export function csvEscape(value: string | number) {
  const stringValue = String(value);
  return `"${stringValue.replaceAll('"', '""')}"`;
}

export function buildPayoutsCsv(rows: PayoutEarningRow[]) {
  const grouped = new Map<string, { email: string; displayName: string; cents: number }>();

  rows.forEach((row) => {
    const current = grouped.get(row.user_id) ?? {
      email: row.users?.email ?? "",
      displayName: row.users?.display_name ?? "",
      cents: 0,
    };

    current.cents += row.amount_cents;
    grouped.set(row.user_id, current);
  });

  return [
    ["user_id", "email", "display_name", "amount_cents"].map(csvEscape).join(","),
    ...Array.from(grouped.entries()).map(([userId, row]) =>
      [userId, row.email, row.displayName, row.cents].map(csvEscape).join(","),
    ),
  ].join("\n");
}
