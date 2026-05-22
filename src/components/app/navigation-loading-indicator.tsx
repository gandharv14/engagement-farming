"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Spinner } from "@/components/ui/spinner";

const NAVIGATION_TIMEOUT_MS = 8000;

function isPlainLeftClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function shouldShowNavigationLoading(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") {
    return false;
  }

  if (anchor.hasAttribute("download")) {
    return false;
  }

  const nextUrl = new URL(anchor.href);
  const currentUrl = new URL(window.location.href);

  if (nextUrl.origin !== currentUrl.origin) {
    return false;
  }

  return nextUrl.pathname !== currentUrl.pathname || nextUrl.search !== currentUrl.search;
}

export function NavigationLoadingIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(() => `${pathname}?${searchParams.toString()}`, [pathname, searchParams]);
  const [pendingFromRouteKey, setPendingFromRouteKey] = useState<string | null>(null);
  const isNavigating = pendingFromRouteKey === routeKey;

  useEffect(() => {
    if (!isNavigating) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setPendingFromRouteKey(null);
    }, NAVIGATION_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [isNavigating]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || !isPlainLeftClick(event) || !(event.target instanceof Element)) {
        return;
      }

      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");

      if (!anchor || !shouldShowNavigationLoading(anchor)) {
        return;
      }

      setPendingFromRouteKey(routeKey);
    }

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [routeKey]);

  if (!isNavigating) {
    return null;
  }

  return (
    <div aria-live="polite" aria-label="Loading page" role="status">
      <div className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-primary/15">
        <div className="h-full w-1/3 animate-pulse bg-primary" />
      </div>
      <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full border bg-background/95 px-3 py-2 text-sm shadow-lg backdrop-blur">
        <Spinner className="size-4" />
        <span className="text-muted-foreground">Loading</span>
      </div>
    </div>
  );
}
