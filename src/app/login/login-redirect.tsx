"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export function LoginRedirect() {
  useEffect(() => {
    const embedded = window.self !== window.top;

    if (!embedded) {
      window.location.replace("/api/auth/login");
    }
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Redirecting to Labelbox SSO. If this app is embedded in another page, continue in the top-level window.
      </p>
      <Button asChild>
        <a href="/api/auth/login" target="_top">
          Continue with Labelbox SSO
        </a>
      </Button>
    </div>
  );
}
