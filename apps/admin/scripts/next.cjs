/* eslint-disable @typescript-eslint/no-require-imports -- Bootstrap must load env synchronously before requiring Next CLI. */
// Next's CLI reads PORT before it loads .env files. Load the same Next env stack
// first so init.js's allocated port and authentication URL stay consistent.
const { createRequire } = require('node:module');
const nextRequire = createRequire(require.resolve('next/package.json'));
const { loadEnvConfig } = nextRequire('@next/env');

const command = process.argv[2];
if (!['dev', 'start'].includes(command)) throw new Error('Expected dev or start');
loadEnvConfig(process.cwd(), command === 'dev');
require('next/dist/bin/next');
