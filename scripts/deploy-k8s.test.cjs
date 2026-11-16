const { test } = require('node:test');
const assert = require('node:assert/strict');
test('migration job bounds execution, never embeds database credentials and rejects mutable image tags', async () => {
  const { migrationJob } = await import('./deploy-k8s.mjs');
  const options = { name: 'test-migrate-1', namespace: 'test', image: `ghcr.io/test/db@sha256:${'a'.repeat(64)}`, secret: 'test-api' };
  const job = migrationJob(options);
  assert.equal(job.spec.backoffLimit, 0);
  assert.equal(job.spec.activeDeadlineSeconds, 600);
  assert.equal(job.spec.template.spec.containers[0].env[0].valueFrom.secretKeyRef.key, 'DATABASE_URL');
  assert.equal(job.spec.template.spec.securityContext.runAsNonRoot, true);
  assert.equal(job.spec.template.spec.securityContext.seccompProfile.type, 'RuntimeDefault');
  assert.equal(job.spec.template.spec.containers[0].securityContext.allowPrivilegeEscalation, false);
  assert.throws(() => migrationJob({...options,image:'db:latest'}), /digest/);
});
test('deployment config rejects arrays/non-string values', async () => {
  const { stringMap } = await import('./deploy-k8s.mjs');
  assert.deepEqual(stringMap('{"API_URL":"https://api.example.com"}', 'test'), {API_URL:'https://api.example.com'});
  for (const value of ['[]','null','{"secret":12}']) assert.throws(() => stringMap(value,'test'));
});
test('sensitive command failures suppress stderr that may contain submitted Secret values', async () => {
  const { runCommand } = await import('./deploy-k8s.mjs');
  const marker = 'simulated-private-value';
  const args = ['-e', 'process.stderr.write(process.env.TEST_PRIVATE_VALUE); process.exit(1)'];
  assert.throws(() => runCommand(process.execPath, args, { sensitive: true, env: { ...process.env, TEST_PRIVATE_VALUE: marker } }), error => {
    assert.match(error.message, /sensitive command output suppressed/);
    assert.equal(error.message.includes(marker), false);
    return true;
  });
});
