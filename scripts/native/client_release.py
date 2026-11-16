"""Build metadata and optional client uploads. Credentials stay in environment/private files."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile


def storage_args(env):
    bucket = env.get("STORAGE_BUCKET", "")
    prefix = env.get("STORAGE_PREFIX", "").strip("/")
    if not bucket or "/" in bucket or not prefix or any(part in ("", ".", "..") for part in prefix.split("/")):
        raise ValueError("Set STORAGE_BUCKET and a nonempty, dedicated STORAGE_PREFIX")
    endpoint = ["--endpoint-url", env["STORAGE_ENDPOINT"]] if env.get("STORAGE_ENDPOINT") else []
    return endpoint, f"s3://{bucket}/{prefix}"


def metadata(env):
    platform = env["CLIENT_PLATFORM"]
    if platform not in ("h5", "mp-weixin"):
        raise ValueError("Unsupported client platform")
    target = Path("apps/app/dist/build") / platform
    document = {"version": env["VITE_APP_VERSION"], "platform": platform,
                "commit": env["GITHUB_SHA"], "runId": env["GITHUB_RUN_ID"],
                "runAttempt": env["GITHUB_RUN_ATTEMPT"]}
    # Keep metadata outside the mini-program code package: its budget is checked before upload.
    output = target / "release.json" if platform == "h5" else Path("client-release.json")
    output.write_text(json.dumps(document, indent=2) + "\n")


def publish_h5(env):
    endpoint, destination = storage_args(env)
    output = Path("apps/app/dist/build/h5")
    if not (output / "index.html").is_file() or not (output / "release.json").is_file():
        raise ValueError("Build output or metadata missing")
    # Never delete old hashed assets while an already-open client may still request them.
    subprocess.run(["aws", *endpoint, "s3", "sync", str(output), destination,
                    "--exclude", "index.html", "--exclude", "release.json", "--cache-control", "no-cache"], check=True)
    subprocess.run(["aws", *endpoint, "s3", "cp", str(output / "index.html"), f"{destination}/index.html", "--cache-control", "no-cache"], check=True)
    subprocess.run(["aws", *endpoint, "s3", "cp", str(output / "release.json"), f"{destination}/release.json", "--cache-control", "no-cache"], check=True)


def publish_weixin(env):
    appid = env.get("MP_WEIXIN_APP_ID")
    secret = env.get("MP_WEIXIN_UPLOAD_KEY")
    if not appid or not secret:
        raise ValueError("Missing WeChat application id or upload key")
    with tempfile.TemporaryDirectory(prefix="weixin-signing-") as directory:
        private_key = Path(directory) / "private.key"
        private_key.write_text(secret)
        private_key.chmod(0o600)
        cli = Path(env["RUNNER_TEMP"]) / "miniprogram-ci/node_modules/.bin/miniprogram-ci"
        subprocess.run([str(cli), "upload", "--appid", appid, "--pkp", str(private_key),
                        "--pp", "apps/app/dist/build/mp-weixin", "--uv", env["VITE_APP_VERSION"], "--minify", "true"], check=True, timeout=600)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["metadata", "h5", "weixin"])
    command = parser.parse_args().command
    {"metadata": metadata, "h5": publish_h5, "weixin": publish_weixin}[command](os.environ)
