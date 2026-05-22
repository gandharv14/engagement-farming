import { Flame } from "lucide-react";

import { LoginRedirect } from "@/app/login/login-redirect";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function LoginPage() {
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
        <CardContent>
          <LoginRedirect />
        </CardContent>
      </Card>
    </main>
  );
}
