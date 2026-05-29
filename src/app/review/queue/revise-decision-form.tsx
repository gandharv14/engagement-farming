"use client";

import { RefreshCw } from "lucide-react";

import { reviseReviewDecision } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function ReviseDecisionForm({ rowId, currentStatus }: { rowId: string; currentStatus: string }) {
  const targetStatus = currentStatus === "accepted_clean" ? "rejected" : "accepted_clean";
  const flipToFail = targetStatus === "rejected";
  const label = flipToFail ? "Change to Fail" : "Change to Pass";
  const confirmMessage = flipToFail
    ? "Change this decision from Pass to Fail? Acceptance rewards for this task will be reversed."
    : "Change this decision from Fail to Pass? Acceptance rewards for this task will be granted.";

  return (
    <form
      action={reviseReviewDecision.bind(null, rowId)}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="status" value={targetStatus} />
      <Button type="submit" size="sm" variant={flipToFail ? "destructive" : "outline"}>
        <RefreshCw className="h-3.5 w-3.5" />
        {label}
      </Button>
    </form>
  );
}
