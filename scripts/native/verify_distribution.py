"""Check source-bound metadata and package bytes again before external distribution."""
import hashlib
import json
import os
from pathlib import Path
import re

from validate_apk import validate_apk
from validate_ipa import validate_ipa


def verify(env, directory=Path("release")):
    directory = Path(directory)
    metadata = json.loads((directory / "metadata.json").read_text())
    expected = {"repository": env["GITHUB_REPOSITORY"], "commit": env["SOURCE_COMMIT"],
                "branch": "main", "runId": env["SOURCE_RUN_ID"], "runAttempt": env["SOURCE_RUN_ATTEMPT"],
                "platform": env["PACK_PLATFORM"], "target": env["TARGET_NAME"]}
    if any(str(metadata.get(key)) != str(value) for key, value in expected.items()):
        raise ValueError("Artifact metadata does not match the verified source run")
    platform = metadata["platform"]
    if platform not in ("android", "ios"):
        raise ValueError("Unsupported package platform")
    filename = "app.ipa" if platform == "ios" else "app.apk"
    if metadata.get("file") != filename:
        raise ValueError("Unexpected artifact filename")
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", str(metadata.get("version", ""))):
        raise ValueError("Invalid package version")
    number = int(env["SOURCE_RUN_NUMBER"])
    attempt = int(env["SOURCE_RUN_ATTEMPT"])
    if number < 1 or not 0 < attempt < 1000:
        raise ValueError("Invalid source run number or attempt")
    if metadata["version"] != f"1.0.{number}" or type(metadata.get("versionCode")) is not int or metadata["versionCode"] != number * 1000 + attempt:
        raise ValueError("Package version does not match the trusted source run")
    if not re.fullmatch(r"[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+", str(metadata.get("bundleId", ""))):
        raise ValueError("Invalid package bundle identifier")
    package = directory / filename
    if hashlib.sha256(package.read_bytes()).hexdigest() != metadata.get("sha256"):
        raise ValueError("Artifact checksum mismatch")
    if platform == "ios":
        validate_ipa(package, metadata["bundleId"], metadata["version"], metadata["versionCode"])
    else:
        validate_apk(package, metadata["bundleId"], metadata["version"], metadata["versionCode"])
    return metadata, package


if __name__ == "__main__":
    verify(os.environ)
    print("Source run, branch, commit, package structure and checksum verified.")
