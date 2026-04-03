import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  userAc,
} from "better-auth/plugins/admin/access";
import {
  defaultStatements as organizationStatements,
  adminAc as organizationAdminAc,
  ownerAc as organizationOwnerAc,
} from "better-auth/plugins/organization/access";

export const statements = {
  ...defaultStatements,
  ...organizationStatements,
  profile: ["read", "update"],
  workspace: ["read", "manage"],
} as const;

export const platformAccessControl = createAccessControl(statements);

export const platformRoles = {
  admin: platformAccessControl.newRole({
    ...adminAc.statements,
    profile: ["read", "update"],
    workspace: ["read", "manage"],
  }),
  user: platformAccessControl.newRole({
    ...userAc.statements,
    profile: ["read", "update"],
  }),
};

export const tenantAccessControl = createAccessControl(statements);

export const tenantRoles = {
  owner: tenantAccessControl.newRole({
    ...organizationOwnerAc.statements,
    profile: ["read", "update"],
    workspace: ["read", "manage"],
  }),
  admin: tenantAccessControl.newRole({
    ...organizationAdminAc.statements,
    profile: ["read", "update"],
    workspace: ["read", "manage"],
  }),
  member: tenantAccessControl.newRole({
    user: ["get"],
    profile: ["read"],
    workspace: ["read"],
  }),
};
