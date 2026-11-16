"""Exercise the real shell timeout/retry behavior without DCloud requests."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


@unittest.skipUnless(shutil.which("timeout"), "GNU timeout required (as on CI)")
class CloudInitializationTests(unittest.TestCase):
    def run_initialization(self, mode):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            cli = root / "cli"
            cli.write_text('''#!/usr/bin/env bash
if [ "$1" = user ]; then
  echo "login arguments: $DCLOUD_USERNAME $DCLOUD_PASSWORD"
  echo attempt >> "$TEST_ATTEMPTS"
  if [ "$TEST_MODE" = login-hang ]; then sleep 30; fi
  if [ "$TEST_MODE" = login-fail ]; then exit 1; fi
fi
if [ "$1" = project ] && [ "$2" = open ]; then
  echo attempt >> "$TEST_PROJECT_ATTEMPTS"
  if [ "$TEST_MODE" = project-hang ]; then sleep 30; fi
  if [ "$TEST_MODE" = project-recover ] && [ "$(wc -l < "$TEST_PROJECT_ATTEMPTS")" -eq 1 ]; then sleep 30; fi
fi
exit 0
''')
            cli.chmod(0o755)
            attempts = root / "attempts"
            env = dict(os.environ, PATH=directory + os.pathsep + os.environ["PATH"],
                       DCLOUD_USERNAME="test-user", DCLOUD_PASSWORD="test-secret",
                       PROJECT_PATH=directory, DCLOUD_STARTUP_DELAY_SECONDS="0",
                       DCLOUD_RETRY_DELAY_SECONDS="0", DCLOUD_LOGIN_TIMEOUT="0.1s",
                       DCLOUD_PROJECT_TIMEOUT="0.1s", TEST_MODE=mode,
                       TEST_ATTEMPTS=str(attempts), TEST_PROJECT_ATTEMPTS=str(root / "projects"))
            result = subprocess.run(
                ["bash", str(Path(__file__).with_name("initialize_cloud_project.sh"))],
                env=env, capture_output=True, text=True, timeout=5)
            self.assertNotIn("test-secret", result.stdout + result.stderr)
            self.assertNotIn("test-user", result.stdout + result.stderr)
            project_count = len((root / "projects").read_text().splitlines()) if (root / "projects").exists() else 0
            return result, len(attempts.read_text().splitlines()), project_count

    def test_success(self):
        result, attempts, projects = self.run_initialization("success")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(attempts, 1)

    def test_hung_login_is_retried_and_bounded(self):
        result, attempts, projects = self.run_initialization("login-hang")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(attempts, 5)
        self.assertIn("exit 124", result.stdout)

    def test_failed_login_stops_after_five_attempts(self):
        result, attempts, projects = self.run_initialization("login-fail")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(attempts, 5)

    def test_hung_project_open_is_bounded(self):
        result, attempts, projects = self.run_initialization("project-hang")
        self.assertEqual(result.returncode, 124)
        self.assertEqual(attempts, 1)
        self.assertEqual(projects, 3)

    def test_project_import_recovers_on_retry(self):
        result, attempts, projects = self.run_initialization("project-recover")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(attempts, 1)
        self.assertEqual(projects, 2)
