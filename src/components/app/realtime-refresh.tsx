"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type Subscription = {
  table: string;
  filter?: string;
};

export function RealtimeRefresh({
  subscriptions,
  pollIntervalMs,
}: {
  subscriptions: Subscription[];
  pollIntervalMs?: number;
}) {
  const router = useRouter();
  // Callers pass a fresh array literal each render, so depending on `subscriptions`
  // directly would re-run the effect (re-fetching the token and rebuilding the
  // realtime channel) on every render. Key the effect on its serialized contents.
  const subscriptionsKey = JSON.stringify(subscriptions);

  useEffect(() => {
    const activeSubscriptions = JSON.parse(subscriptionsKey) as Subscription[];
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    if (pollIntervalMs && pollIntervalMs > 0) {
      pollTimer = setInterval(() => router.refresh(), pollIntervalMs);
    }

    if (!url || !anonKey || activeSubscriptions.length === 0) {
      return () => {
        if (pollTimer) {
          clearInterval(pollTimer);
        }
      };
    }

    const supabaseUrl = url;
    const supabaseAnonKey = anonKey;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    async function subscribe() {
      const response = await fetch("/api/supabase-token", { cache: "no-store" });

      if (!response.ok || cancelled) {
        return;
      }

      const { token } = (await response.json()) as { token?: string };

      if (!token || cancelled) {
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });

      supabase.realtime.setAuth(token);

      const channel = supabase.channel(`page-refresh-${activeSubscriptions.map((item) => item.table).join("-")}`);
      let refreshTimer: ReturnType<typeof setTimeout> | null = null;

      activeSubscriptions.forEach((subscription) => {
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: subscription.table,
            filter: subscription.filter,
          },
          () => {
            if (refreshTimer) {
              clearTimeout(refreshTimer);
            }

            refreshTimer = setTimeout(() => router.refresh(), 300);
          },
        );
      });

      channel.subscribe();

      cleanup = () => {
        if (refreshTimer) {
          clearTimeout(refreshTimer);
        }

        void supabase.removeChannel(channel);
      };
    }

    void subscribe();

    return () => {
      cancelled = true;
      cleanup?.();
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    };
  }, [pollIntervalMs, router, subscriptionsKey]);

  return null;
}
