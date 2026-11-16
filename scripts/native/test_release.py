import base64
import hashlib
import json
import os
from pathlib import Path
import plistlib
import tempfile
import subprocess
from unittest.mock import patch
import unittest
import zipfile

from build_metadata import create_metadata
from collect_app_package import collect
from plan import plan
from prepare_pack import prepare
from redact import public_log, sensitive_values
from validate_apk import validate_apk
from validate_ipa import validate_ipa
from verify_distribution import verify
from client_release import storage_args


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def test_android_archive_must_be_real_base_apk(self):
        path = self.root / "app.apk"
        path.write_text("<html>error</html>")
        with self.assertRaises(zipfile.BadZipFile):
            validate_apk(path, "com.example.app", "1.0.23", 23002)
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("error.txt", "not apk")
        with self.assertRaisesRegex(ValueError, "AndroidManifest"):
            validate_apk(path, "com.example.app", "1.0.23", 23002)

    def test_ipa_wrong_bundle_or_version_is_rejected(self):
        path = self.root / "app.ipa"
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("Payload/App.app/Info.plist", plistlib.dumps({"CFBundleIdentifier": "com.example.app", "CFBundleExecutable": "App", "CFBundleShortVersionString": "1.0.1", "CFBundleVersion": "1001"}))
            archive.writestr("Payload/App.app/App", b"executable")
        validate_ipa(path, "com.example.app", "1.0.1", 1001)
        with self.assertRaises(ValueError):
            validate_ipa(path, "com.another.app", "1.0.1", 1001)
        with self.assertRaises(ValueError):
            validate_ipa(path, "com.example.app", "1.0.2", 1001)

    def test_signing_config_uses_json_encoding_not_shell_interpolation(self):
        project = self.root / "apps/app/src"
        project.mkdir(parents=True)
        (project / "manifest.json").write_text('{}')
        (project / "androidPrivacy.json").write_text('{}')
        password = 'quote" dollar$() backtick` newline\n'
        env = dict(PACK_PLATFORM="android", BUNDLE_ID="com.example.app", DCLOUD_APP_ID="__UNI__EXAMPLE", APP_NAME="Test app",
                   VERSION_NAME="1.0.1", VERSION_CODE="1001", PRIVACY_URL="https://legal.acme.app/privacy", AGREEMENT_URL="https://legal.acme.app/terms", LEGAL_VERSION="2026.11",
                   SIGNING_DIR=str(self.root / "signing"), ANDROID_KEYSTORE_BASE64=base64.b64encode(b"keystore").decode(),
                   ANDROID_KEY_ALIAS="release", ANDROID_KEY_PASSWORD=password, ANDROID_KEYSTORE_PASSWORD=password)
        path = Path(prepare(env, self.root))
        config = json.loads(path.read_text())
        self.assertEqual(config["android"]["certpassword"], password)
        privacy = json.loads((project / "androidPrivacy.json").read_text())
        self.assertEqual(privacy["version"], env["LEGAL_VERSION"])
        self.assertIn(env["PRIVACY_URL"], privacy["message"])
        self.assertIn(env["AGREEMENT_URL"], privacy["message"])
        with self.assertRaisesRegex(ValueError, "does not match"):
            prepare({**env, "VITE_LEGAL_VERSION": "old"}, self.root)
        self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        self.assertEqual((project / "manifest.json").read_text().count('__UNI__EXAMPLE'), 1)
        redacted = public_log(password + " https://example.test/app.apk?token=secret", sensitive_values(path, env))
        self.assertNotIn(password, redacted)
        self.assertNotIn('token=secret', redacted)

    def test_android_matrix_rejects_duplicate_and_invalid_targets(self):
        self.assertEqual(plan('[{"name":"default","bundle":"com.example.app"}]')[0]["name"], "default")
        with self.assertRaisesRegex(ValueError, "bundle identifiers must be unique"):
            plan('[{"name":"a","bundle":"com.example.app"},{"name":"b","bundle":"com.example.app"}]')
        for value in ('[]', '[{"name":"a","bundle":"bad"}]', '[{"name":"a","bundle":"com.example.app"},{"name":"a","bundle":"com.example.other"}]', '[{"name":"$(bad)","bundle":"com.example.app"}]'):
            with self.assertRaises(ValueError):
                plan(value)

    @patch("validate_apk.subprocess.run")
    def test_distribution_checks_run_attempt_commit_and_checksum(self, analyzer):
        analyzer.side_effect = lambda args, **kwargs: subprocess.CompletedProcess(args, 0, {"application-id": "com.example.app", "version-name": "1.0.23", "version-code": "23002"}[args[2]] + "\n")
        package = self.root / "app.apk"
        with zipfile.ZipFile(package, "w") as archive:
            archive.writestr("AndroidManifest.xml", b"manifest")
            archive.writestr("classes.dex", b"dex payload")
        env = dict(GITHUB_REPOSITORY="example/repo", SOURCE_COMMIT="a" * 40, SOURCE_RUN_ID="23", SOURCE_RUN_ATTEMPT="2", SOURCE_RUN_NUMBER="23", PACK_PLATFORM="android", TARGET_NAME="default")
        metadata = dict(bundleId="com.example.app", repository="example/repo", commit="a" * 40, runId="23", runAttempt="2", platform="android", target="default", branch="main", version="1.0.23", versionCode=23002, file="app.apk", sha256=hashlib.sha256(package.read_bytes()).hexdigest())
        path = self.root / "metadata.json"
        path.write_text(json.dumps(metadata))
        verify(env, self.root)
        for change in ({"runAttempt": "1"}, {"commit": "b" * 40}, {"file": "../app.apk"}, {"branch": "feature"}, {"sha256": "wrong"}, {"bundleId": "com.other.app"}, {"version": "1.0.22"}, {"versionCode": 23001}, {"versionCode": None}, {"bundleId": None}):
            path.write_text(json.dumps({**metadata, **change}))
            with self.assertRaises(ValueError):
                verify(env, self.root)


    def test_apk_identity_is_checked_before_collection_metadata_and_distribution(self):
        package = self.root / "local.apk"
        with zipfile.ZipFile(package, "w") as archive:
            archive.writestr("AndroidManifest.xml", b"compiled manifest fixture")
            archive.writestr("classes.dex", b"dex payload")
        (self.root / "pack_output.log").write_text(f"Package location:{package}\n")
        project = self.root / "apps/app/src"
        project.mkdir(parents=True)
        (project / "manifest.json").write_text(json.dumps({"versionName": "1.0.23", "versionCode": 23002}))
        env = dict(PACK_PLATFORM="android", TARGET_NAME="default", BUNDLE_ID="com.example.app", VERSION_NAME="1.0.23", VERSION_CODE="23002", GITHUB_REPOSITORY="example/repo", GITHUB_SHA="a" * 40, GITHUB_REF_NAME="main", GITHUB_RUN_ID="23", GITHUB_RUN_ATTEMPT="2")
        expected = {"application-id": "com.example.app", "version-name": "1.0.23", "version-code": "23002"}
        def reader(values):
            def run(args, **kwargs):
                self.assertEqual(args[:2], ["apkanalyzer", "manifest"])
                self.assertEqual(kwargs["timeout"], 30)
                self.assertTrue(kwargs["check"])
                return subprocess.CompletedProcess(args, 0, values[args[2]] + "\n")
            return run
        with patch("validate_apk.subprocess.run", side_effect=reader(expected)):
            collect("android", self.root, env)
            self.assertEqual(create_metadata(env, self.root)["bundleId"], "com.example.app")
        for field, wrong in (("application-id", "com.other.variant"), ("version-name", "1.0.22"), ("version-code", "22001")):
            with self.subTest(field=field), patch("validate_apk.subprocess.run", side_effect=reader({**expected, field: wrong})):
                with self.assertRaisesRegex(ValueError, field):
                    collect("android", self.root, env)
                self.assertEqual((self.root / "result/status").read_text(), "failed\n")
                (self.root / "result/status").write_text("success\n")
                with self.assertRaisesRegex(ValueError, field):
                    create_metadata(env, self.root)
        for error in (FileNotFoundError(), subprocess.CalledProcessError(1, "apkanalyzer"), subprocess.TimeoutExpired("apkanalyzer", 30)):
            with self.subTest(error=type(error).__name__), patch("validate_apk.subprocess.run", side_effect=error):
                with self.assertRaisesRegex(ValueError, "Cannot inspect APK"):
                    validate_apk(package, "com.example.app", "1.0.23", 23002)

    def test_storage_requires_dedicated_prefix(self):
        for env in ({"STORAGE_BUCKET": "bucket"}, {"STORAGE_BUCKET": "bucket", "STORAGE_PREFIX": "a/../b"}):
            with self.assertRaises(ValueError):
                storage_args(env)
        for prefix in (".", "a/./b", "a//b"):
            with self.assertRaises(ValueError):
                storage_args({"STORAGE_BUCKET": "bucket", "STORAGE_PREFIX": prefix})
        self.assertEqual(storage_args({"STORAGE_BUCKET": "bucket", "STORAGE_PREFIX": "sites/app"})[1], "s3://bucket/sites/app")
