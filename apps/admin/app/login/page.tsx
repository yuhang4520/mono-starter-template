import { LoginForm } from "./login-form";

export default async function Page() {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
      <div className="absolute bottom-4 flex flex-col items-center gap-1 text-xs text-muted-foreground">
        <span>© 2026 Your Company. All rights reserved.</span>
      </div>
    </div>
  );
}
