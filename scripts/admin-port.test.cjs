const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

test('Next environment is loaded before CLI port selection, preserving file and process priorities', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-admin-port-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, '.env'), 'PORT=3317\n');
  fs.writeFileSync(path.join(root, '.env.local'), 'PORT=3318\n');
  fs.writeFileSync(path.join(root, '.env.development.local'), 'PORT=3320\n');
  const wrapper = path.resolve(__dirname, '../apps/admin/scripts/next.cjs');
  // Exercise the real @next/env loader; replace only the CLI entry to avoid opening ports.
  const script = `const Module=require('node:module');const original=Module._load;
    Module._load=function(request,parent,isMain){if(request==='next/dist/bin/next'){console.log('CLI_PORT='+process.env.PORT);return {}}return original.call(this,request,parent,isMain)};
    process.argv=[process.execPath,${JSON.stringify(wrapper)},process.env.TEST_NEXT_COMMAND];require(${JSON.stringify(wrapper)});`;
  const env = { ...process.env }; delete env.PORT; delete env.NODE_ENV;
  for (const [command, override, expected] of [['dev', undefined, '3320'], ['start', undefined, '3318'], ['dev', '3319', '3319']]) {
    const result = spawnSync(process.execPath, ['-e', script], { cwd: root, env: { ...env, TEST_NEXT_COMMAND: command, ...(override ? { PORT: override } : {}) }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(`CLI_PORT=${expected}`), result.stdout);
  }
});
