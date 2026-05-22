"use client";

import { LogIn } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

const loginHref = "/api/auth/login?returnTo=%2F";

export function LoginRedirect() {
  const [isRedirecting, setIsRedirecting] = useState(false);

  function markRedirecting() {
    setIsRedirecting(true);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Continue to Labelbox SSO to access Sprint Arcade.</p>
      <Button asChild>
        <a href={loginHref} onClick={markRedirecting} target="_top">
          <LogIn className="mr-2 h-4 w-4" />
          {isRedirecting ? "Opening Labelbox SSO..." : "Continue with Labelbox SSO"}
        </a>
      </Button>
    </div>
  );
}
