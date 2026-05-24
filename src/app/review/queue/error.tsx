"use client";

import { Button } from "@/components/ui/button";

export default function ReviewQueueError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="arena-panel rounded-3xl p-6">
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-pink">Reviewer Dashboard</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Unable to load review tasks</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        The reviewer portal could not read the review queue. This usually means the database query failed or Supabase is
        not configured for this deployment.
      </p>
      <p className="mt-4 rounded-xl border border-arena-pink/25 bg-arena-pink/10 p-3 font-mono text-xs text-muted-foreground">
        {error.message}
      </p>
      <Button type="button" className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
