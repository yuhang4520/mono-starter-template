const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deploymentPlan } = require('./deployment-plan.cjs');
test('shared service changes rebuild both consumers but do not replay unchanged migrations', () => {
  assert.deepEqual(deploymentPlan(['packages/workspace/src/index.ts']), { api: true, admin: true, db: false, images: ['api','admin'] });
});
test('database and workflow changes include migrations and both consumers', () => {
  for (const file of ['packages/db/drizzle/0003.sql','.github/workflows/deploy.yaml','pnpm-lock.yaml'])
    assert.deepEqual(deploymentPlan([file]).images, ['api','admin','migration']);
});
test('client-only changes do not deploy servers; first deployment can force all', () => {
  assert.deepEqual(deploymentPlan(['apps/app/src/main.ts']).images, []);
  assert.deepEqual(deploymentPlan([], true).images, ['api','admin','migration']);
});
test('API-only change leaves admin image unchanged', () => {
  assert.deepEqual(deploymentPlan(['apps/api/src/router.ts']).images, ['api']);
});
