function verifySourceRun(run, expected) {
  if (run.conclusion !== 'success' || run.status !== 'completed'
    || run.event !== 'workflow_dispatch' || run.path !== '.github/workflows/pack-native.yaml'
    || run.head_branch !== 'main' || run.head_sha !== expected.sha
    || run.head_repository?.full_name !== expected.repository
    || !Number.isInteger(run.run_number) || run.run_number < 1
    || !Number.isInteger(run.run_attempt) || run.run_attempt < 1) {
    throw new Error('Source run is not a successful trusted native package run');
  }
}
module.exports = { verifySourceRun };
