"""Bind each package to the source workflow run and immutable commit."""
import hashlib
import json
import os
from pathlib import Path
import re

from validate_ipa import validate_ipa
from validate_apk import validate_apk


def create_metadata(env, directory=Path(".")):
    directory = Path(directory)
    platform = env["PACK_PLATFORM"]
    target = env["TARGET_NAME"]
    if platform not in ("android", "ios") or not re.fullmatch(r"[a-z0-9-]{1,40}", target):
        raise ValueError("Invalid package target")
    extension = "ipa" if platform == "ios" else "apk"
    package = directory / "dist" / f"app.{extension}"
    if (directory / "result/status").read_text().strip() != "success":
        raise ValueError("Package collection did not succeed")
    manifest = json.loads((directory / "apps/app/src/manifest.json").read_text())
    if platform == "ios":
        validate_ipa(package, env["BUNDLE_ID"], manifest["versionName"], manifest["versionCode"])
    else:
        validate_apk(package, env["BUNDLE_ID"], manifest["versionName"], manifest["versionCode"])
    metadata = {"platform": platform, "target": target, "bundleId": env["BUNDLE_ID"],
                "repository": env["GITHUB_REPOSITORY"], "commit": env["GITHUB_SHA"],
                "branch": env["GITHUB_REF_NAME"], "runId": env["GITHUB_RUN_ID"],
                "runAttempt": env["GITHUB_RUN_ATTEMPT"], "version": manifest["versionName"],
                "versionCode": manifest["versionCode"], "file": package.name,
                "sha256": hashlib.sha256(package.read_bytes()).hexdigest()}
    (directory / "dist/metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    return metadata


if __name__ == "__main__":
    create_metadata(os.environ)
