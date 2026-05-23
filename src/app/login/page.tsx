import { AlertCircle, Flame } from "lucide-react";
import { redirect } from "next/navigation";

import { LoginRedirect } from "@/app/login/login-redirect";
import { GameRulesDialog } from "@/components/app/game-rules-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, getHomePathForRole } from "@/lib/auth";
import { getSafeLoginReturnTo } from "@/lib/return-to";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    returnTo?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const returnTo = getSafeLoginReturnTo(params.returnTo);
  const user = await getCurrentUser();

  if (user) {
    redirect(returnTo === "/" ? getHomePathForRole(user.role) : returnTo);
  }

  const error = params.error;
  const hasSsoError = Array.isArray(error) ? error.includes("sso") : error === "sso";

  return (
    <main className="arena-bg relative flex min-h-screen items-center justify-center bg-background p-6">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <GameRulesDialog />
      </div>
      <Card className="max-w-md">
        <CardHeader>
          <div className="arena-glow mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-arena-cyan via-arena-blue to-arena-pink text-primary-foreground">
            <Flame className="h-5 w-5" />
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-cyan">Enter Arena</p>
          <CardTitle>Sign in to Tokenmaxxing</CardTitle>
          <CardDescription>Use your Labelbox SSO account through Auth0.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasSsoError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>SSO could not complete</AlertTitle>
              <AlertDescription>
                Try again, or check the Auth0 callback URL and API audience configuration for this deployment.
              </AlertDescription>
            </Alert>
          ) : null}
          <LoginRedirect returnTo={returnTo} />
        </CardContent>
      </Card>
    </main>
  );
}
