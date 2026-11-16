const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const YAML = require('yaml');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, '.github/workflows');
for (const file of fs.readdirSync(directory).filter(name => /\.ya?ml$/.test(name))) {
  const document = YAML.parseDocument(fs.readFileSync(path.join(directory, file), 'utf8'), { uniqueKeys: true });
  assert.equal(document.errors.length, 0, `${file}: ${document.errors.map(e => e.message).join('; ')}`);
  const workflow = document.toJS();
  assert.ok(workflow.on && workflow.jobs, `${file}: missing trigger/jobs`);
  for (const [name, job] of Object.entries(workflow.jobs)) {
    for (const dependency of [].concat(job.needs || [])) assert.ok(workflow.jobs[dependency], `${file}/${name}: unknown dependency ${dependency}`);
    for (const item of [job, ...(job.steps || [])]) {
      if (item.uses?.startsWith('./')) {
        assert.ok(fs.existsSync(path.join(root, item.uses)), `${file}: missing local action/workflow ${item.uses}`);
      }
    }
  }
}
const checks = YAML.parse(fs.readFileSync(path.join(directory,'checks.yaml'),'utf8'));
const verification = checks.jobs.verify;
assert.equal(new URL(verification.env.TEST_DATABASE_URL).password, verification.services.postgres.env.POSTGRES_PASSWORD, 'CI database password mismatch');
assert.ok(verification.env.TEST_DATABASE_URL, 'Integration tests must not silently skip');
const deploy = YAML.parse(fs.readFileSync(path.join(directory,'deploy.yaml'),'utf8'));
assert.ok(deploy.jobs.rollout.needs.includes('images'), 'Rollout must depend on successful image builds');
assert.ok(deploy.jobs.images.needs === 'changes');
assert.ok(deploy.jobs.changes.needs === 'checks');
assert.equal(deploy.concurrency['cancel-in-progress'], false, 'Never cancel an in-progress migration');
console.log('Workflow structure and deployment gates verified');
