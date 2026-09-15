import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--sidebar))] p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center text-white">
          <div className="text-sm uppercase tracking-[0.2em] text-white/60">Ash Aviation Stores</div>
          <h1 className="mt-2 text-3xl font-semibold">Inventory / GRN / Costing</h1>
          <p className="mt-2 text-sm text-white/70">UK aviation stores administration</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
