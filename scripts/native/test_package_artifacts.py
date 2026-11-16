import plistlib
import os
import sys
import subprocess
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from collect_app_package import collect
from validate_ipa import validate_ipa
from run_cloud_pack import run_pack, queue_conflict, cloud_pack_failure, CloudPackError


def make_ipa(path):
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("Payload/Student.app/Info.plist", plistlib.dumps({
            "CFBundleIdentifier": "com.example.starter",
            "CFBundleExecutable": "Student",
        }))
        archive.writestr("Payload/Student.app/Student", b"fixture executable")


class PackageArtifactsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def log(self, text):
        (self.root / "pack_output.log").write_text(text)

    def assert_failed(self):
        self.assertEqual((self.root / "result/status").read_text(), "failed\n")
        self.assertEqual((self.root / "result/local_artifact").read_text(), "")

    def test_actual_packaging_failure_never_downloads_error_page(self):
        self.log("Type:iOS Appstore    Packaging failure    Error log:"
                 "https://app.liuyingyong.cn/build/errorLog/fixture")
        with patch("collect_app_package.subprocess.run") as download:
            with self.assertRaisesRegex(ValueError, "packaging failure"):
                collect("ios", self.root)
            download.assert_not_called()
        self.assert_failed()

    def test_generic_url_is_not_a_package_download(self):
        self.log("https://app.liuyingyong.cn/build/errorLog/fixture")
        with patch("collect_app_package.subprocess.run") as download:
            with self.assertRaisesRegex(ValueError, "explicit"):
                collect("ios", self.root)
            download.assert_not_called()
        self.assert_failed()

    def test_download_returning_html_cannot_publish_success(self):
        self.log("Type:iOS Appstore Download: https://example.invalid/app.ipa")
        def download(args, **kwargs):
            Path(args[-1]).write_text("<!doctype html><title>Packaging error</title>")
        with patch("collect_app_package.subprocess.run", side_effect=download):
            with self.assertRaises(zipfile.BadZipFile):
                collect("ios", self.root)
        self.assert_failed()

    def test_valid_download_and_local_ipa(self):
        self.log("Type:iOS Appstore    Download: https://example.invalid/app.ipa")
        def download(args, **kwargs):
            make_ipa(Path(args[-1]))
        with patch("collect_app_package.subprocess.run", side_effect=download):
            self.assertEqual(collect("ios", self.root), "dist/app.ipa")
        self.assertEqual((self.root / "result/status").read_text(), "success\n")
        source = self.root / "local.ipa"
        make_ipa(source)
        self.log(f"Path: {source}\n")
        self.assertEqual(collect("ios", self.root), "dist/app.ipa")

    def test_invalid_local_ipa_is_rejected(self):
        source = self.root / "local.ipa"
        source.write_text("HTML instead of IPA")
        self.log(f"Path: {source}\n")
        with self.assertRaises(zipfile.BadZipFile):
            collect("ios", self.root)
        self.assert_failed()

    def test_zip_without_app_payload_is_rejected(self):
        path = self.root / "not-an-ipa.zip"
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("error.txt", "not an app")
        with self.assertRaisesRegex(ValueError, "Payload"):
            validate_ipa(path)

    def test_truncated_archive_and_missing_executable_are_rejected(self):
        path = self.root / "app.ipa"
        make_ipa(path)
        data = path.read_bytes()
        path.write_bytes(data[:len(data) // 2])
        with self.assertRaises(zipfile.BadZipFile):
            validate_ipa(path)
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("Payload/Student.app/Info.plist", plistlib.dumps({
                "CFBundleIdentifier": "fixture", "CFBundleExecutable": "missing",
            }))
        with self.assertRaisesRegex(ValueError, "executable"):
            validate_ipa(path)

    def test_android_local_artifact_is_preserved(self):
        source = self.root / "app.apk"
        with zipfile.ZipFile(source, "w") as archive:
            archive.writestr("AndroidManifest.xml", b"manifest")
            archive.writestr("classes.dex", b"dex payload")
        self.log(f"Package location:{source}\n")
        env = dict(BUNDLE_ID="com.example.app", VERSION_NAME="1.0.1", VERSION_CODE="1001")
        values = {"application-id": "com.example.app", "version-name": "1.0.1", "version-code": "1001"}
        with patch("validate_apk.subprocess.run", side_effect=lambda args, **kwargs: subprocess.CompletedProcess(args, 0, values[args[2]])):
            self.assertEqual(collect("android", self.root, env), "dist/app.apk")
        self.assertEqual((self.root / "dist/app.apk").read_bytes(), source.read_bytes())


QUEUE_PROMPT = (
    "It was detected that the installation package that was being made in this project "
    "was in the cloud queue, and continued packaging would cancel the production and "
    "queue up in the cloud team. Do you continue to submit it?"
)


class CloudQueueTest(unittest.TestCase):
    def test_queue_prompt_then_own_success(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "pack_output.log"
            success = "Type:iOS Appstore Download: https://example.invalid/current.ipa"
            responses = [subprocess.CompletedProcess([], 0, QUEUE_PROMPT + "\nType:iOS Appstore Download: https://example.invalid/older.ipa"),
                         subprocess.CompletedProcess([], 0, success)]
            with patch("run_cloud_pack.subprocess.run", side_effect=responses) as cli, \
                 patch("run_cloud_pack.time.sleep") as sleep:
                self.assertEqual(run_pack("current-config.json", log), 0)
                self.assertEqual(cli.call_count, 2)
                sleep.assert_called_once_with(30)
                for call in cli.call_args_list:
                    self.assertEqual(call.args[0], ["cli", "pack", "--config", "current-config.json"])
                    self.assertEqual(call.kwargs["stdin"], subprocess.DEVNULL)
            self.assertNotIn(QUEUE_PROMPT, log.read_text())
            self.assertNotIn("older.ipa", log.read_text())
            self.assertIn(success, log.read_text())
            def download(args, **kwargs):
                self.assertIn("https://example.invalid/current.ipa", args)
                self.assertNotIn("https://example.invalid/older.ipa", args)
                make_ipa(Path(args[-1]))
            with patch("collect_app_package.subprocess.run", side_effect=download):
                self.assertEqual(collect("ios", Path(directory)), "dist/app.ipa")
            self.assertEqual((Path(directory) / "result/status").read_text(), "success\n")

    def test_real_cli_failure_is_not_retried(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch("run_cloud_pack.subprocess.run", return_value=
                       subprocess.CompletedProcess([], 7, "compile error")) as cli:
                self.assertEqual(run_pack("config.json", Path(directory) / "log"), 7)
                cli.assert_called_once()

    def test_busy_queue_has_a_deadline(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch("run_cloud_pack.time.monotonic", side_effect=[0, 1, 11]), \
                 patch("run_cloud_pack.subprocess.run", return_value=
                       subprocess.CompletedProcess([], 0, QUEUE_PROMPT)) as cli:
                with self.assertRaisesRegex(TimeoutError, "queue remained busy"):
                    run_pack("config.json", Path(directory) / "log", wait_seconds=10)
                cli.assert_called_once()

    def test_command_timeout_preserves_diagnostics(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "log"
            with patch("run_cloud_pack.subprocess.run", side_effect=
                       subprocess.TimeoutExpired("cli", 1, output=b"building current package")):
                with self.assertRaises(TimeoutError):
                    run_pack("config.json", log)
            self.assertIn("building current package", log.read_text())

    def test_chinese_prompt_and_normal_queue_progress(self):
        self.assertTrue(queue_conflict("检测到本项目已有正在制作的安装包在云端队列中,是否继续提交？"))
        self.assertFalse(queue_conflict("Type:iOS Appstore Queueing"))
        self.assertFalse(queue_conflict("Type:iOS Appstore Download: https://example.invalid/app.ipa"))


QUOTA_ERROR = (
    "12:43:27.476 Cloud server returns error: <br>1. You have packed many times today. "
    "Let the cloud packing server take a break. You can come back tomorrow. <br>"
    "Please log in with your current account https://dev.dcloud.net.cn and select Pay Package."
)


class CloudFailureTest(unittest.TestCase):
    def test_teacher_zero_exit_packaging_failure_stops_before_artifact_collection(self):
        output = (
            "Package status of project starter [__UNI__EXAMPLE]: "
            "Type:iOS Appstore Packaging failure "
            "Error log:https://app.liuyingyong.cn/build/errorLog/fixture\n"
        )
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "pack_output.log"
            with patch("run_cloud_pack.subprocess.run", return_value=
                       subprocess.CompletedProcess([], 0, output)) as cli:
                with self.assertRaises(CloudPackError) as error:
                    run_pack("teacher-config.json", log)
                self.assertEqual(error.exception.code, "dcloud_build_failed")
                cli.assert_called_once()
            self.assertEqual(log.read_text(), output)
            with patch("collect_app_package.subprocess.run") as download:
                with self.assertRaises(CloudPackError):
                    collect("ios", Path(directory))
                download.assert_not_called()
            self.assertEqual((Path(directory) / "result/status").read_text(), "failed\n")

    def test_actual_zero_exit_quota_rejection_fails_without_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "pack_output.log"
            with patch("run_cloud_pack.subprocess.run", return_value=subprocess.CompletedProcess([], 0, QUOTA_ERROR)) as cli, \
                 patch("run_cloud_pack.time.sleep") as sleep:
                with self.assertRaisesRegex(CloudPackError, "quota/rate limit") as error:
                    run_pack("config.json", log)
                self.assertEqual(error.exception.code, "dcloud_package_quota")
                cli.assert_called_once()
                sleep.assert_not_called()
            self.assertEqual(log.read_text(), QUOTA_ERROR)

    def test_collector_reports_cloud_rejection_for_ios_and_android(self):
        for platform in ["ios", "android"]:
            with self.subTest(platform=platform), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / "pack_output.log").write_text(QUOTA_ERROR)
                with patch("collect_app_package.subprocess.run") as download:
                    with self.assertRaisesRegex(CloudPackError, "quota/rate limit"):
                        collect(platform, root)
                    download.assert_not_called()
                self.assertEqual((root / "result/status").read_text(), "failed\n")
                self.assertFalse((root / "dist").exists())

    def test_other_cloud_errors_are_not_silently_successful(self):
        error = cloud_pack_failure("Cloud server returns error: service unavailable")
        self.assertEqual(error.code, "dcloud_server_error")
        with tempfile.TemporaryDirectory() as directory:
            with patch("run_cloud_pack.subprocess.run", return_value=subprocess.CompletedProcess([], 0, "Cloud server returns error: invalid request")):
                with self.assertRaises(CloudPackError):
                    run_pack("config.json", Path(directory) / "log")
        self.assertEqual(cloud_pack_failure("云端服务器返回错误：打包次数已达上限").code, "dcloud_package_quota")
        self.assertIsNone(cloud_pack_failure("今天可用打包次数剩余 3 次"))
        self.assertIsNone(cloud_pack_failure("免费打包次数不足时自动扣减付费次数"))
        self.assertIsNone(cloud_pack_failure("Type:iOS Appstore Queueing"))
        self.assertIsNone(cloud_pack_failure(QUEUE_PROMPT))

    def test_cli_entrypoint_exits_failed_and_records_reason(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fake_cli = root / "cli"
            fake_cli.write_text("#!" + sys.executable + "\nprint(" + repr(QUOTA_ERROR) + ")\n")
            fake_cli.chmod(0o755)
            env = {**os.environ, "PATH": str(root) + os.pathsep + os.environ.get("PATH", "")}
            result = subprocess.run([sys.executable, str(Path(__file__).with_name("run_cloud_pack.py").resolve()), "--config", "fixture.json"], cwd=root, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertIn("::error::DCloud rejected packaging", result.stdout)
            self.assertEqual((root / "result/error_code").read_text(), "dcloud_package_quota\n")
            self.assertIn("No IPA/APK", (root / "result/error_message").read_text())
            self.assertEqual((root / "result/status").read_text(), "failed\n")


if __name__ == "__main__":
    unittest.main()
