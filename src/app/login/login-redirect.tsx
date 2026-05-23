"use client";

import { LogIn } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

function getLoginHref(returnTo: string) {
  return `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function LoginRedirect({ returnTo = "/" }: { returnTo?: string }) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const loginHref = getLoginHref(returnTo);

  function markRedirecting() {
    setIsRedirecting(true);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Continue to Labelbox SSO to access Tokenmaxxing.</p>
      <Button asChild>
        <a href={loginHref} onClick={markRedirecting} target="_top" aria-busy={isRedirecting || undefined}>
          {isRedirecting ? <Spinner className="mr-2 h-4 w-4" /> : <LogIn className="mr-2 h-4 w-4" />}
          {isRedirecting ? "Opening Labelbox SSO..." : "Continue with Labelbox SSO"}
        </a>
      </Button>
    </div>
  );
}
