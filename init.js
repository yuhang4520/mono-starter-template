#!/usr/bin/env node
/** Initialize a fresh checkout. Never overwrite an existing environment or rotate its credentials. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const readline = require('node:readline/promises');

const DEFAULT_PORTS = { db: 5342, api: 4000, admin: 3000, app: 5173, storage: 9000, console: 9001 };
const ENV_FILES = ['.env', 'packages/db/.env', 'apps/api/.env', 'apps/admin/.env', 'apps/app/env/.env.local'];
const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.localdata', 'coverage', '.terraform', '.agents', '.codex', 'test-results', 'graphify-out']);

async function availablePort(start, reserved) {
  for (let port = start; port <= 65535; port++) {
    if (reserved.has(port)) continue;
    const available = await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once('error', (error) => error.code === 'EADDRINUSE' ? resolve(false) : reject(error));
      server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
    });
    if (available) { reserved.add(port); return port; }
  }
  throw new Error('No available local port');
}

async function findAvailablePorts() {
  const ports = {};
  const reserved = new Set();
  for (const [name, port] of Object.entries(DEFAULT_PORTS)) ports[name] = await availablePort(port, reserved);
  return ports;
}

function renameFiles(root, prefix) {
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (SKIP.has(entry.name) || entry.isSymbolicLink()) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { visit(file); continue; }
      if (!entry.isFile() || entry.name.startsWith('.env') && !entry.name.endsWith('.example')) continue;
      if (!/\.(?:json|yaml|yml|ts|tsx|js|mjs|cjs|vue|md|sh|tf|example|code-workspace)$/.test(entry.name) && entry.name !== 'Dockerfile') continue;
      // The initializer and its fixtures must remain usable as a template regression suite.
      if (file === path.join(root, 'init.js') || file === path.join(root, 'scripts/init.test.cjs')) continue;
      const original = fs.readFileSync(file, 'utf8');
      const renamed = original.replaceAll('@your-project/', `@${prefix}/`).replaceAll('mono-starter-template', prefix);
      if (renamed !== original) fs.writeFileSync(file, renamed);
    }
  };
  visit(root);
}

function initializeProject(root, { prefix, ports }) {
  if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(prefix)) throw new Error('Prefix must use 1–50 lowercase letters, digits or hyphens');
  if (fs.existsSync(path.join(root, '.template-initialized.json'))) throw new Error('Already initialized; edit existing configuration instead');
  for (const name of ENV_FILES) {
    if (fs.existsSync(path.join(root, name))) throw new Error(`Refusing to overwrite ${name}; initialize a fresh checkout`);
  }
  if (Object.keys(DEFAULT_PORTS).some(key => !Number.isInteger(ports[key]) || ports[key] < 1024 || ports[key] > 65535)
      || new Set(Object.values(ports)).size !== Object.keys(DEFAULT_PORTS).length) throw new Error('Ports must be distinct integers between 1024 and 65535');
  const secret = () => crypto.randomBytes(32).toString('hex');
  const dbPassword = secret();
  const storagePassword = secret();
  const authSecret = secret();
  const betterAuthSecret = secret();
  const replacements = {
    '__DB_PASSWORD__': dbPassword,
    '__STORAGE_PASSWORD__': storagePassword,
    '__AUTH_SECRET__': authSecret,
    '__BETTER_AUTH_SECRET__': betterAuthSecret,
    'postgres:example@localhost:5342': `postgres:${dbPassword}@localhost:${ports.db}`,
    'localhost:5342': `localhost:${ports.db}`,
    'localhost:4000': `localhost:${ports.api}`,
    'localhost:3000': `localhost:${ports.admin}`,
    'localhost:5173': `localhost:${ports.app}`,
    '127.0.0.1:9000': `127.0.0.1:${ports.storage}`,
    'DB_PORT=5342': `DB_PORT=${ports.db}`,
    'API_PORT=4000': `API_PORT=${ports.api}`,
    'ADMIN_PORT=3000': `ADMIN_PORT=${ports.admin}`,
    'MINIO_API_PORT=9000': `MINIO_API_PORT=${ports.storage}`,
    'MINIO_CONSOLE_PORT=9001': `MINIO_CONSOLE_PORT=${ports.console}`,
    'PORT=4000': `PORT=${ports.api}`,
    'PORT=3000': `PORT=${ports.admin}`,
    'VITE_APP_PORT=5173': `VITE_APP_PORT=${ports.app}`,
    'COMPOSE_PROJECT_NAME=starter': `COMPOSE_PROJECT_NAME=${prefix}`,
  };
  const plans = ENV_FILES.map((target) => {
    const example = target === 'apps/app/env/.env.local' ? 'apps/app/env/.env.example' : `${target}.example`;
    let content = fs.readFileSync(path.join(root, example), 'utf8');
    // Replace against the original text once: a new port such as 40000 must not
    // be matched again by the shorter PORT=4000 replacement.
    const pattern = new RegExp(Object.keys(replacements).sort((a, b) => b.length - a.length)
      .map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    content = content.replace(pattern, match => replacements[match]);
    return { target, content };
  });
  renameFiles(root, prefix);
  for (const { target, content } of plans) fs.writeFileSync(path.join(root, target), content, { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(path.join(root, '.template-initialized.json'), JSON.stringify({ prefix, ports }, null, 2) + '\n', { flag: 'wx' });
  return { prefix, ports };
}

async function main() {
  const args = process.argv.slice(2);
  let prefix = args.find(value => value.startsWith('--prefix='))?.slice(9);
  if (!prefix && args.includes('--defaults')) prefix = 'your-project';
  if (!prefix) {
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    try { prefix = (await prompt.question('项目包名前缀 [your-project]: ')).trim() || 'your-project'; }
    finally { prompt.close(); }
  }
  const result = initializeProject(process.cwd(), { prefix, ports: await findAvailablePorts() });
  console.log(`Initialized ${result.prefix}. Credentials were written to ignored .env files.`);
  console.log(JSON.stringify(result.ports, null, 2));
  console.log('Next: pnpm install → pnpm infra:up → pnpm db:migrate → pnpm dev:api / pnpm dev:admin / pnpm dev:app');
}

module.exports = { DEFAULT_PORTS, ENV_FILES, initializeProject, findAvailablePorts };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
