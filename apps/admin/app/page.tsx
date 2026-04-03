import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Admin Starter</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        You are signed in as {session.user.phoneNumber ?? session.user.email ?? session.user.id}.
      </p>
    </main>
  );
}
