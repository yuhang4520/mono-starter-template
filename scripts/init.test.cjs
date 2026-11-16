const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { initializeProject, DEFAULT_PORTS, ENV_FILES } = require('../init.js');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-init-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const target of ENV_FILES) {
    const example = target === 'apps/app/env/.env.local' ? 'apps/app/env/.env.example' : `${target}.example`;
    fs.mkdirSync(path.dirname(path.join(root, example)), { recursive: true });
    fs.copyFileSync(path.join(__dirname, '..', example), path.join(root, example));
  }
  const scope = JSON.parse(fs.readFileSync(path.join(__dirname, '../apps/api/package.json'))).name.split('/')[0];
  for (const file of ['apps/app/tsconfig.json', 'apps/app/src/lib/trpc.ts', 'apps/api/package.json', 'apps/api/Dockerfile', 'pnpm-lock.yaml']) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    const content = fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replaceAll(`${scope}/`, '@your-project/');
    fs.writeFileSync(path.join(root, file), content);
  }
  return root;
}
function env(root, file) {
  return Object.fromEntries(fs.readFileSync(path.join(root, file), 'utf8').trim().split('\n').map(line => {
    const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)];
  }));
}

test('fresh initialization renames imports, paths and lockfile; creates consistent private environments', t => {
  const root = fixture(t);
  const ports = Object.fromEntries(Object.entries(DEFAULT_PORTS).map(([k,v]) => [k,v + 10000]));
  initializeProject(root, { prefix: 'sample-product', ports });
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'apps/api/package.json'))).name, '@sample-product/api');
  assert.match(fs.readFileSync(path.join(root, 'apps/app/src/lib/trpc.ts'), 'utf8'), /@sample-product\/api/);
  assert.match(fs.readFileSync(path.join(root, 'apps/app/tsconfig.json'), 'utf8'), /@sample-product\/api/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8'), /@your-project\//);
  const compose = env(root, '.env'), api = env(root, 'apps/api/.env'), admin = env(root, 'apps/admin/.env'), db = env(root, 'packages/db/.env');
  assert.match(compose.POSTGRES_PASSWORD, /^[a-f0-9]{64}$/);
  assert.equal(new URL(api.DATABASE_URL).password, compose.POSTGRES_PASSWORD);
  assert.equal(api.DATABASE_URL, db.DATABASE_URL);
  assert.equal(api.DATABASE_URL, admin.DATABASE_URL);
  assert.equal(new URL(api.DATABASE_URL).port, String(ports.db));
  assert.equal(api.S3_SECRET_ACCESS_KEY, compose.MINIO_ROOT_PASSWORD);
  assert.match(api.AUTH_SECRET, /^[a-f0-9]{64}$/);
  assert.match(admin.BETTER_AUTH_SECRET, /^[a-f0-9]{64}$/);
  assert.notEqual(api.AUTH_SECRET, admin.BETTER_AUTH_SECRET);
  assert.equal(compose.MINIO_API_PORT, String(ports.storage));
  const app = env(root, 'apps/app/env/.env.local');
  assert.equal(app.VITE_PRIVACY_URL, `http://localhost:${ports.admin}/app-agreement/privacy`);
  assert.equal(app.VITE_AGREEMENT_URL, `http://localhost:${ports.admin}/app-agreement/user`);
  assert.equal(app.VITE_LEGAL_VERSION, admin.LEGAL_VERSION);
  for (const file of ENV_FILES) assert.equal(fs.statSync(path.join(root, file)).mode & 0o077, 0);
});

test('repeat initialization never rotates secrets or changes names', t => {
  const root = fixture(t);
  initializeProject(root, { prefix: 'demo', ports: DEFAULT_PORTS });
  const before = fs.readFileSync(path.join(root, '.env'), 'utf8');
  assert.throws(() => initializeProject(root, { prefix: 'other', ports: DEFAULT_PORTS }), /Already initialized/);
  assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), before);
});

test('allocated ports are substituted exactly once even when they contain a default port', t => {
  const root = fixture(t);
  const ports = { ...DEFAULT_PORTS, api: 40000, admin: 30000 };
  initializeProject(root, { prefix: 'port-check', ports });
  assert.equal(env(root, '.env').API_PORT, '40000');
  assert.equal(env(root, '.env').ADMIN_PORT, '30000');
  assert.equal(env(root, 'apps/api/.env').PORT, '40000');
  assert.equal(env(root, 'apps/admin/.env').PORT, '30000');
  assert.equal(env(root, 'apps/app/env/.env.local').VITE_PRIVACY_URL, 'http://localhost:30000/app-agreement/privacy');
});

test('existing environment or invalid prefix is rejected before renaming', t => {
  const root = fixture(t);
  assert.throws(() => initializeProject(root, { prefix: '../oops', ports: DEFAULT_PORTS }), /Prefix/);
  fs.writeFileSync(path.join(root, 'apps/admin/.env'), 'existing');
  assert.throws(() => initializeProject(root, { prefix: 'demo', ports: DEFAULT_PORTS }), /Refusing to overwrite/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'apps/api/package.json'))).name, '@your-project/api');
});
