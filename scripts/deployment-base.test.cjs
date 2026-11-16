const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deploymentBase } = require('./deployment-base.cjs');
test('failed release and skipped rollout cannot hide pending migrations', async () => {
  const runs=[{id:3,head_sha:'c'.repeat(40),conclusion:'success'},{id:2,head_sha:'b'.repeat(40),conclusion:'failure'},{id:1,head_sha:'a'.repeat(40),conclusion:'success'}];
  const base=await deploymentBase({listRuns:async()=>runs,listJobs:async id=>[{name:'rollout',conclusion:id===3?'skipped':'success',completed_at:'2026-01-01T00:00:00Z'}],isAncestor:async()=>true});
  assert.equal(base,'a'.repeat(40));
});
test('first deploy and rewritten history require a full rollout', async () => {
  const common={listJobs:async()=>[{name:'rollout',conclusion:'success',completed_at:'2026-01-01T00:00:00Z'}],isAncestor:async()=>false};
  assert.equal(await deploymentBase({...common,listRuns:async()=>[]}),null);
  assert.equal(await deploymentBase({...common,listRuns:async()=>[{id:1,head_sha:'a'.repeat(40),conclusion:'success'}]}),null);
});

test('an older run rerun later is the actual deployment baseline', async () => {
  const runs=[{id:2,head_sha:'b'.repeat(40),conclusion:'success'},{id:1,head_sha:'a'.repeat(40),conclusion:'success'}];
  const base=await deploymentBase({listRuns:async()=>runs,listJobs:async id=>[{name:'rollout',conclusion:'success',completed_at:id===1?'2026-01-03T00:00:00Z':'2026-01-02T00:00:00Z'}],isAncestor:async()=>true});
  assert.equal(base,'a'.repeat(40));
});
