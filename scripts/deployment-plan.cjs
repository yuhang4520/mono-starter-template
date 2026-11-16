/** Shared packages and tooling must rebuild every backend consumer. */
function deploymentPlan(files, force = false) {
  const common = force || files.some(file => /^(packages\/|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|package\.json$|\.npmrc$|\.dockerignore$|\.github\/|scripts\/|infra\/)/.test(file));
  const api = common || files.some(file => file.startsWith('apps/api/'));
  const admin = common || files.some(file => file.startsWith('apps/admin/'));
  const db = force || files.some(file => /^(packages\/db\/|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|packages\/tsconfig\/|\.github\/|infra\/|scripts\/deploy)/.test(file));
  return { api, admin, db, images: [api && 'api', admin && 'admin', db && 'migration'].filter(Boolean) };
}
module.exports = { deploymentPlan };
