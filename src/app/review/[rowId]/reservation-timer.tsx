"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { releaseReviewReservation } from "@/app/actions";

type ReservationTimerProps = {
  rowId: string;
  reservedUntil: string;
};

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ReservationTimer({ rowId, reservedUntil }: ReservationTimerProps) {
  const router = useRouter();
  const expiresAt = useMemo(() => new Date(reservedUntil).getTime(), [reservedUntil]);
  const [remainingMs, setRemainingMs] = useState(() => expiresAt - Date.now());
  const releaseStarted = useRef(false);

  useEffect(() => {
    const updateRemaining = () => {
      setRemainingMs(expiresAt - Date.now());
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (remainingMs > 0 || releaseStarted.current) {
      return;
    }

    releaseStarted.current = true;
    void releaseReviewReservation(rowId).finally(() => {
      router.replace("/review/queue");
      router.refresh();
    });
  }, [remainingMs, router, rowId]);

  return (
    <div className="rounded-2xl border border-arena-gold/25 bg-arena-gold/10 p-4">
      <p className="text-xs text-muted-foreground">Reservation expires in</p>
      <p className="font-mono text-3xl font-semibold text-arena-gold">{formatRemaining(remainingMs)}</p>
      <p className="mt-1 text-xs text-muted-foreground">The row returns to the queue when this timer reaches zero.</p>
    </div>
  );
}
