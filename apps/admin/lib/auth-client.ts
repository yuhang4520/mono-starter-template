import {
  adminClient,
  organizationClient,
  phoneNumberClient,
  usernameClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import {
  tenantAccessControl,
  tenantRoles,
  platformAccessControl,
  platformRoles,
} from "./permissions";

export const authClient = createAuthClient({
  /** The base URL of the server (optional if you're using the same domain) */
  //   baseURL: "http://localhost:3000",
  plugins: [
    phoneNumberClient(),
    usernameClient(),
    adminClient({
      ac: platformAccessControl,
      roles: platformRoles,
    }),
    organizationClient({
      ac: tenantAccessControl,
      roles: tenantRoles,
    }),
  ],
});
