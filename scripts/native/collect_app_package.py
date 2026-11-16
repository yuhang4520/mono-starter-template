"""Collect only successful HBuilder package output; never treat error-log URLs as IPAs."""
import argparse
import os
from pathlib import Path
import re
import shutil
import subprocess

from validate_ipa import validate_ipa
from validate_apk import validate_apk
from run_cloud_pack import queue_conflict, cloud_pack_failure


def collect(platform, directory=Path("."), env=None):
    env = os.environ if env is None else env
    directory = Path(directory)
    result = directory / "result"
    result.mkdir(exist_ok=True)
    (result / "status").write_text("failed\n")
    (result / "local_artifact").write_text("")
    log = (directory / "pack_output.log").read_text()
    failure = cloud_pack_failure(log)
    if failure:
        raise failure
    if re.search(r"Packaging\s+failure|ARCHIVE FAILED|打包失败|文件不存在|项目.*不存在", log, re.I):
        raise ValueError("HBuilder reported packaging failure; inspect pack_output.log")
    extension = "ipa" if platform == "ios" else "apk"
    local = re.search(r"^\s*(?:Path:|Package location:)\s*(\S+)", log, re.M)
    if not local:
        local = re.search(r"(/[a-zA-Z0-9./_-]+apps/[a-zA-Z0-9./_-]+\." + extension + r")\b", log)
    source = Path(local.group(1)) if local else None
    if source and not source.is_absolute():
        source = directory / source
    target = directory / "dist" / f"app.{extension}"
    target.parent.mkdir(exist_ok=True)
    if source and source.is_file():
        shutil.copyfile(source, target)
    elif platform == "ios":
        # A generic liuyingyong.cn URL can be an HTML error log, even with HTTP 200.
        download = re.search(r"Type:iOS Appstore\s+Download:\s+(https?://\S+)", log)
        if not download and queue_conflict(log):
            raise ValueError("Cloud queue confirmation prevented submission; use run_cloud_pack.py to wait safely")
        if not download or "/build/errorLog/" in download.group(1):
            raise ValueError("No explicit iOS Appstore Download URL or local IPA found")
        try:
            subprocess.run(["curl", "-L", "--fail", "--retry", "3", "--retry-delay", "2", "--max-time", "300",
                            download.group(1), "-o", str(target)], check=True)
        except subprocess.CalledProcessError:
            raise ValueError("Package download failed; signed URL omitted") from None
    else:
        raise ValueError("No generated APK found")
    if not target.is_file() or target.stat().st_size == 0:
        raise ValueError("Package is missing or empty")
    if platform == "ios":
        validate_ipa(target)
    else:
        validate_apk(target, env["BUNDLE_ID"], env["VERSION_NAME"], env["VERSION_CODE"])
    (result / "local_artifact").write_text(f"dist/app.{extension}\n")
    (result / "status").write_text("success\n")
    return f"dist/app.{extension}"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--platform", choices=["ios", "android"], required=True)
    args = parser.parse_args()
    collect(args.platform)
    with open(os.environ["GITHUB_OUTPUT"], "a") as output:
        output.write("has_local_artifact=true\n")
