"use server";

import { headers } from "next/headers";
import { auth } from "./auth";
import { redirect } from "next/navigation";
import { statements } from "./permissions";

/**
 * platform roles always take precendence over the tenant roles.
 */
export async function authorize(permissions: {
  [key in keyof typeof statements]?:
    | (typeof statements)[key][number][]
    | undefined;
}): Promise<{ granted: boolean; organizationId?: string; uid: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  // authorizing by platform roles.
  if (session.user.role !== "user") {
    const { success } = await auth.api.userHasPermission({
      body: {
        permissions: permissions,
        userId: session.user.id,
      },
    });

    return { granted: success, uid: session.user.id };
  }

  // authorizing by tenant roles.
  // tenant user must have an active organization.
  if (!session.session.activeOrganizationId) {
    return { granted: false, uid: session.user.id };
  }

  const { success } = await auth.api.hasPermission({
    headers: await headers(),
    body: {
      permissions: permissions,
      organizationId: session.session.activeOrganizationId,
    },
  });

  return {
    granted: success,
    organizationId: session.session.activeOrganizationId,
    uid: session.user.id,
  };
}
