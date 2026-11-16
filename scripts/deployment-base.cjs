/** Only a successful rollout is a deployment baseline; successful/skipped checks are not. */
async function deploymentBase({ listRuns, listJobs, isAncestor }) {
  let latest = null;
  for (let page = 1; page <= 5; page++) {
    const runs = await listRuns(page);
    for (const run of runs) {
      if (run.conclusion !== 'success' || !/^[a-f0-9]{40}$/.test(run.head_sha)) continue;
      const jobs = await listJobs(run.id);
      const rollout = jobs.find(job => job.name === 'rollout' && job.conclusion === 'success');
      const completedAt = Date.parse(rollout?.completed_at || '');
      // Reruns retain their original run creation time: compare rollout completion instead.
      if (Number.isFinite(completedAt) && (!latest || completedAt > latest.completedAt)) latest = { sha: run.head_sha, completedAt };
    }
    if (runs.length < 20) break;
  }
  return latest && await isAncestor(latest.sha) ? latest.sha : null;
}
module.exports = { deploymentBase };
