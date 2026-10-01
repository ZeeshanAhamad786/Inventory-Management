import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(220_14%_96%)] p-6 dark:bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="text-[22px] font-bold tracking-tight">Aeroswift</div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Parts Control</div>
          <p className="mt-3 text-sm text-muted-foreground">Workshop jobs, GRN receiving & stock</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
