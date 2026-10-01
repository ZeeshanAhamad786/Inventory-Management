"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loginSchema, type LoginFormValues } from "@/schemas";
import { aeroAuthService } from "@/services/aero/authService";
import { useAuthStore } from "@/stores/app-store";
import { AERO_DEMO_LOGIN } from "@/db/aero-seed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: AERO_DEMO_LOGIN.email, password: AERO_DEMO_LOGIN.password },
  });

  return (
    <Card className="w-full max-w-md border-border shadow-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Aeroswift Parts Control demo. Data stays in this browser.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              const user = await aeroAuthService.login(values.email, values.password);
              setUser(user);
              toast.success("Signed in");
              router.replace("/jobs");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Unable to sign in");
            }
          })}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...form.register("email")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...form.register("password")} />
          </div>
          <Button className="w-full rounded-xl" type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Demo: {AERO_DEMO_LOGIN.email} / {AERO_DEMO_LOGIN.password}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
