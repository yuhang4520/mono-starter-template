const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function fixture(t, mode = 'success') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-deploy-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const images = {};
  for (const component of ['api', 'admin', 'migration']) {
    images[component] = `ghcr.io/example/${component}@sha256:${'a'.repeat(64)}`;
    fs.mkdirSync(path.join(root, component));
    fs.writeFileSync(path.join(root, component, 'image.txt'), images[component]);
  }
  const env = {
    K8S_NAMESPACE: 'test', APP_NAME: 'starter', KUBECONFIG: path.join(root, 'kubeconfig'),
    DATABASE_URL: 'postgres://fixture.invalid/test',
    API_ENV_JSON: JSON.stringify({ AUTH_SECRET: 'test-auth-'.repeat(8), BETTER_AUTH_SECRET: 'test-better-auth-'.repeat(4) }),
    ADMIN_ENV_JSON: JSON.stringify({ BETTER_AUTH_SECRET: 'test-better-auth-'.repeat(4) }),
    API_CONFIG_JSON: JSON.stringify({ AUTH_URL: 'https://api.product.test', BETTER_AUTH_URL: 'https://api.product.test', ALLOWED_ORIGINS: 'https://app.product.test', S3_BUCKET: 'private-files' }),
    ADMIN_CONFIG_JSON: JSON.stringify({ BETTER_AUTH_URL: 'https://admin.product.test' }),
    DEPLOY_PLAN: JSON.stringify({ api: true, admin: true, db: true }),
    IMAGE_DIRECTORY: root, GITHUB_RUN_ID: '1234', GITHUB_RUN_ATTEMPT: '1',
  };
  const events = [];
  const variables = [];
  const variableFiles = [];
  let clock = 0;
  let initAttempts = 0;
  const deps = {
    now: () => clock,
    sleep: async milliseconds => { events.push({ command: 'sleep', milliseconds }); clock += mode === 'migration-timeout' ? 620_001 : milliseconds; },
    run(command, args, options = {}) {
      // Record resource identities, never Secret values passed through stdin.
      const event = { command, args: [...args] };
      if (options.input) {
        const manifest = JSON.parse(options.input);
        event.kind = manifest.kind;
        event.name = manifest.metadata.name;
        if (manifest.kind === 'Secret') assert.equal(options.sensitive, true, 'Secret admission errors must not echo credentials');
        if (manifest.kind === 'Job') event.image = manifest.spec.template.spec.containers[0].image;
      }
      events.push(event);
      if (command === 'terraform') {
        if (args.includes('init')) {
          initAttempts++;
          if (mode === 'terraform-init-failed' || mode === 'terraform-init-retry' && initAttempts < 3) throw new Error('terraform init failure');
        }
        if (args.includes('apply')) {
          const file = args.find(arg => arg.startsWith('-var-file=')).slice('-var-file='.length);
          variableFiles.push(file);
          variables.push(JSON.parse(fs.readFileSync(file, 'utf8')));
          if (mode === 'terraform-apply-failed') throw new Error('terraform apply failure');
        }
        return '';
      }
      if (command !== 'kubectl') throw new Error(`Unexpected command ${command}`);
      if (event.kind === 'Job' && mode === 'job-submit-failed') throw new Error('job submission failure');
      if (args.includes('get') && args.includes('job')) {
        if (mode === 'migration-read-failed') throw new Error('job status read failure');
        if (mode === 'migration-timeout') return JSON.stringify({ status: {} });
        return JSON.stringify({ status: mode.startsWith('migration-failed') ? { failed: 1 } : { succeeded: 1 } });
      }
      if (args.includes('logs') && mode === 'migration-failed-logs-failed') throw new Error('log collection failure');
      if (args.includes('get') && args.includes('deployment')) {
        const component = args.includes('starter-api') ? 'api' : 'admin';
        return JSON.stringify({ spec: { template: { spec: { containers: [{ image: mode === 'mutable-existing-image' ? 'example:latest' : images[component] }] } } } });
      }
      if (args.includes('rollout') && mode === 'rollout-failed') throw new Error('rollout failure');
      return '{}';
    },
  };
  return { env, deps, events, variables, variableFiles, images, root };
}

function assertBlockedBeforeApplications(events) {
  assert.equal(events.filter(event => event.kind === 'Secret' && ['starter-api', 'starter-admin'].includes(event.name)).length, 0);
  assert.equal(events.filter(event => event.command === 'terraform').length, 0);
  assert.equal(events.filter(event => event.args?.includes('rollout')).length, 0);
}

for (const [mode, error] of [
  ['migration-failed', /Migration did not succeed/],
  ['migration-timeout', /Migration did not succeed/],
  ['migration-read-failed', /job status read failure/],
  ['migration-failed-logs-failed', /Migration did not succeed/],
  ['job-submit-failed', /job submission failure/],
]) {
  test(`${mode} preserves application state and cleans the temporary credential`, async t => {
    const { deploy } = await import('./deploy-k8s.mjs');
    const state = fixture(t, mode);
    await assert.rejects(deploy(state.env, state.deps), error);
    assertBlockedBeforeApplications(state.events);
    assert.ok(state.events.some(event => event.args?.includes('delete') && event.args.includes('secret') && event.args.includes('starter-migrate-1234-1')));
  });
}

for (const component of ['api', 'admin', 'migration']) {
  test(`invalid ${component} image is rejected before cluster writes`, async t => {
    const { deploy } = await import('./deploy-k8s.mjs');
    const state = fixture(t);
    fs.writeFileSync(path.join(state.root, component, 'image.txt'), `ghcr.io/example/${component}:latest`);
    await assert.rejects(deploy(state.env, state.deps), /image digest/);
    assert.equal(state.events.filter(event => event.kind).length, 0);
    assertBlockedBeforeApplications(state.events);
  });
}

test('mutable existing image cannot be propagated by a configuration-only rollout', async t => {
  const { deploy } = await import('./deploy-k8s.mjs');
  const state = fixture(t, 'mutable-existing-image');
  state.env.DEPLOY_PLAN = JSON.stringify({ api: false, admin: false, db: false });
  await assert.rejects(deploy(state.env, state.deps), /existing api image digest/);
  assert.equal(state.events.filter(event => event.kind).length, 0);
});

for (const [mode, error] of [['terraform-apply-failed', /terraform apply failure/], ['rollout-failed', /rollout failure/]]) {
  test(`${mode} propagates and removes the local variable file`, async t => {
    const { deploy } = await import('./deploy-k8s.mjs');
    const state = fixture(t, mode);
    await assert.rejects(deploy(state.env, state.deps), error);
    assert.equal(state.variableFiles.length, 1);
    assert.equal(fs.existsSync(state.variableFiles[0]), false);
    if (mode === 'terraform-apply-failed') assert.equal(state.events.some(event => event.args?.includes('rollout')), false);
  });
}

test('successful migration gates application Secret writes and digest-based rollout', async t => {
  const { deploy } = await import('./deploy-k8s.mjs');
  const state = fixture(t);
  await deploy(state.env, state.deps);
  const statusIndex = state.events.findIndex(event => event.args?.includes('get') && event.args.includes('job'));
  const secretIndex = state.events.findIndex(event => event.kind === 'Secret' && event.name === 'starter-api');
  assert.ok(statusIndex >= 0 && secretIndex > statusIndex);
  assert.equal(state.events.find(event => event.kind === 'Job').image, state.images.migration);
  assert.deepEqual(state.variables[0].images, { api: state.images.api, admin: state.images.admin });
  assert.equal(fs.existsSync(state.variableFiles[0]), false);
});

test('same images with rotated credentials change only the affected Secret revision', async t => {
  const { deploy } = await import('./deploy-k8s.mjs');
  const before = fixture(t);
  const after = fixture(t);
  for (const state of [before, after]) state.env.DEPLOY_PLAN = JSON.stringify({ api: false, admin: false, db: false });
  const secret = JSON.parse(after.env.API_ENV_JSON);
  secret.AUTH_SECRET = 'rotated-test-auth-'.repeat(8);
  after.env.API_ENV_JSON = JSON.stringify(secret);
  await deploy(before.env, before.deps);
  await deploy(after.env, after.deps);
  assert.deepEqual(before.variables[0].images, after.variables[0].images);
  assert.notEqual(before.variables[0].secret_revisions.api, after.variables[0].secret_revisions.api);
  assert.equal(before.variables[0].secret_revisions.admin, after.variables[0].secret_revisions.admin);
});

test('Terraform initialization retries are bounded and do not apply on exhaustion', async t => {
  const { deploy } = await import('./deploy-k8s.mjs');
  const state = fixture(t, 'terraform-init-failed');
  await assert.rejects(deploy(state.env, state.deps), /terraform init failure/);
  assert.equal(state.events.filter(event => event.command === 'terraform' && event.args.includes('init')).length, 3);
  assert.deepEqual(state.events.filter(event => event.command === 'sleep').map(event => event.milliseconds), [5000, 10000]);
  assert.equal(state.events.some(event => event.command === 'terraform' && event.args.includes('apply')), false);
});

test('reserved runtime variables and malformed plan fail before writes', async t => {
  const { deploy } = await import('./deploy-k8s.mjs');
  for (const key of ['PORT', 'HOSTNAME', 'NODE_ENV']) {
    const state = fixture(t);
    state.env.API_ENV_JSON = JSON.stringify({ ...JSON.parse(state.env.API_ENV_JSON), [key]: 'unexpected' });
    await assert.rejects(deploy(state.env, state.deps), /controlled by the deployment/);
    assert.equal(state.events.length, 0);
  }
  const state = fixture(t);
  state.env.DEPLOY_PLAN = JSON.stringify({ api: true, admin: true, db: 'false' });
  await assert.rejects(deploy(state.env, state.deps), /boolean/);
  assert.equal(state.events.filter(event => event.kind).length, 0);
});

test('invalid runtime configuration fails before migration or any cluster operation', async t => {
  const { deploy } = await import('./deploy-k8s.mjs');
  for (const [key, value] of [['AUTH_URL', ''], ['BETTER_AUTH_URL', 'javascript:bad'], ['ALLOWED_ORIGINS', '*'], ['ALLOWED_ORIGINS', 'https://app.product.test/path'], ['S3_BUCKET', ''], ['S3_ACCESS_KEY_ID', 'missing-pair'], ['BAD KEY', 'value']]) {
    const state = fixture(t);
    const field = key === 'S3_ACCESS_KEY_ID' ? 'API_ENV_JSON' : 'API_CONFIG_JSON';
    state.env[field] = JSON.stringify({ ...JSON.parse(state.env[field]), [key]: value });
    await assert.rejects(deploy(state.env, state.deps));
    assert.equal(state.events.length, 0, key);
  }
});

test('invalid or overlapping Ingress hosts cannot mutate deployment state', async t => {
  const { deploy } = await import('./deploy-k8s.mjs');
  for (const hosts of [{ api: '' }, { api: 'https://api.product.test' }, { api: '*.product.test' }, { api: 'api.product.test:443' }, { api: 'api.product.test', admin: 'api.product.test' }]) {
    const state = fixture(t);
    state.env.K8S_HOSTS_JSON = JSON.stringify(hosts);
    await assert.rejects(deploy(state.env, state.deps), /Ingress/);
    assert.equal(state.events.length, 0);
  }
});
