import { AlertCircle, Flame } from "lucide-react";
import { redirect } from "next/navigation";

import { LoginRedirect } from "@/app/login/login-redirect";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, getHomePathForRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect(getHomePathForRole(user.role));
  }

  const error = (await searchParams).error;
  const hasSsoError = Array.isArray(error) ? error.includes("sso") : error === "sso";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="max-w-md">
        <CardHeader>
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Flame className="h-5 w-5" />
          </div>
          <CardTitle>Sign in to Sprint Arcade</CardTitle>
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
          <LoginRedirect />
        </CardContent>
      </Card>
    </main>
  );
}
