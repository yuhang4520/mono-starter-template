"""Wait out HBuilder's existing-build prompt without cancelling or reusing that build."""
import argparse
import html
from pathlib import Path
import re
import subprocess
import time

from redact import public_log, sensitive_values


def queue_conflict(output):
    return bool(re.search(
        r"in the cloud queue.*Do you continue to submit|"
        r"本项目.*云端队列中.*是否继续提交", output, re.I | re.S,
    ))


class CloudPackError(ValueError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def cloud_pack_failure(output):
    """HBuilder can return exit code zero even when the cloud rejects the request."""
    text = html.unescape(re.sub(r"<[^>]+>", " ", output))
    text = re.sub(r"\x1b\[[0-9;]*m", "", text)
    server_error = re.search(r"Cloud server returns error\s*[:：]|云(?:端)?服务器返回错误\s*[:：]", text, re.I)
    if re.search(r"you have packed many times today", text, re.I) or (server_error and re.search(
        r"(?:今天|今日).*(?:打包多次|打包次数.*(?:上限|超限|不足|用完|耗尽))|"
        r"(?:免费|云)?打包.*(?:次数|额度).*(?:不足|耗尽|已用完|已达上限)",
        text, re.I,
    )):
        return CloudPackError(
            "dcloud_package_quota",
            "DCloud rejected packaging because the CI account reached its packaging quota/rate limit. "
            "No IPA/APK was created. Check package quota for the same DCloud account used by CI "
            "or wait for the limit to reset before retrying; automatic retries will not fix this.",
        )
    if server_error:
        return CloudPackError("dcloud_server_error", "DCloud rejected the package request; inspect pack_output.log for the original cloud error. No IPA/APK was created.")
    if re.search(r"Packaging\s+failure|ARCHIVE FAILED|EXPORT FAILED|打包失败", text, re.I):
        return CloudPackError(
            "dcloud_build_failed",
            "DCloud reported packaging failure. No valid IPA/APK was created; "
            "inspect the Error log URL in pack_output.log for the build/signing error.",
        )
    return None


def run_pack(config, log_path=Path("pack_output.log"), wait_seconds=2400, interval=30):
    secrets = sensitive_values(config)
    deadline = time.monotonic() + wait_seconds
    with Path(log_path).open("w") as log:
        Path(log_path).chmod(0o600)
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("Cloud packaging wait timed out; existing cloud jobs were not cancelled")
            try:
                completed = subprocess.run(
                    ["cli", "pack", "--config", str(config)],
                    stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT, text=True, timeout=remaining,
                )
            except subprocess.TimeoutExpired as error:
                output = error.stdout or b""
                if isinstance(output, bytes):
                    output = output.decode(errors="replace")
                log.write(output)
                log.flush()
                print(public_log(output, secrets), end="", flush=True)
                raise TimeoutError("Cloud packaging timed out; inspect pack_output.log") from error
            # Only the final attempt is eligible for collection. Queue responses may
            # contain paths/URLs from someone else's older build.
            log.seek(0)
            log.truncate()
            log.write(completed.stdout)
            log.flush()
            print(public_log(completed.stdout, secrets), end="", flush=True)
            failure = cloud_pack_failure(completed.stdout)
            if failure:
                raise failure
            if not queue_conflict(completed.stdout):
                return completed.returncode
            # Do not answer yes: it would cancel a possibly unrelated cloud build.
            # Do not collect that build either: its version/profile may be different.
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("Cloud queue remained busy; existing cloud jobs were not cancelled")
            print("Cloud queue busy; waiting before submitting this run's package.", flush=True)
            time.sleep(min(interval, remaining))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    try:
        code = run_pack(args.config)
    except (OSError, TimeoutError, CloudPackError) as error:
        result = Path("result")
        result.mkdir(exist_ok=True)
        result.joinpath("error_code").write_text(getattr(error, "code", "pack_command_error") + "\n")
        result.joinpath("error_message").write_text(str(error) + "\n")
        print(f"::error::{error}")
        code = 1
    if code:
        Path("result").mkdir(exist_ok=True)
        Path("result/status").write_text("failed\n")
    raise SystemExit(code)
