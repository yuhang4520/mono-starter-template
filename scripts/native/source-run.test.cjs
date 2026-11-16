const assert = require('node:assert/strict');
const test = require('node:test');
const { verifySourceRun } = require('./source-run.cjs');
const expected = { sha: 'a'.repeat(40), repository: 'example/starter' };
const trusted = { conclusion: 'success', status: 'completed', event: 'workflow_dispatch',
  path: '.github/workflows/pack-native.yaml', head_branch: 'main', head_sha: expected.sha,
  head_repository: { full_name: expected.repository }, run_attempt: 2, run_number: 23 };
test('successful main native run is accepted', () => verifySourceRun(trusted, expected));
for (const [name, changed] of Object.entries({
  failed: { conclusion: 'failure' }, pending: { status: 'in_progress' },
  pullRequest: { event: 'pull_request' }, anotherWorkflow: { path: '.github/workflows/checks.yaml' },
  branch: { head_branch: 'feature/demo' }, sha: { head_sha: 'b'.repeat(40) },
  fork: { head_repository: { full_name: 'attacker/starter' } }, attempt: { run_attempt: 0 }, number: { run_number: 0 },
})) {
  test(`reject ${name}`, () => assert.throws(() => verifySourceRun({ ...trusted, ...changed }, expected)));
}
