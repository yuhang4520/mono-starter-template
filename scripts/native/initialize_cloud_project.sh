#!/usr/bin/env bash
# Shared by Android and iOS cloud-pack jobs. Never enable shell tracing here.
set -euo pipefail

: "${DCLOUD_USERNAME:?Missing DCLOUD_USERNAME}"
: "${DCLOUD_PASSWORD:?Missing DCLOUD_PASSWORD}"
: "${PROJECT_PATH:?Missing PROJECT_PATH}"

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
log_dir=$(mktemp -d)
chmod 700 "$log_dir"
trap 'rm -rf "$log_dir"' EXIT
run_cli() {
  local status=0
  "$@" >"$log_dir/cli.log" 2>&1 || status=$?
  # Even login errors can echo credentials. Never stream raw CLI output.
  python3 "$SCRIPT_DIR/redact.py" "$log_dir/cli.log" || echo 'CLI diagnostics could not be sanitized'
  return "$status"
}

# -k also bounds commands that ignore SIGTERM. Redirect stdin to avoid prompts.
echo "Starting HBuilderX (maximum 60 seconds)"
run_cli timeout -k 5s 60s cli open </dev/null || echo "HBuilderX open exited; checking login next"
sleep "${DCLOUD_STARTUP_DELAY_SECONDS:-5}"

login_ok=0
for attempt in 1 2 3 4 5; do
  echo "DCloud login attempt $attempt/5 (maximum ${DCLOUD_LOGIN_TIMEOUT:-90s})"
  if run_cli timeout -k 5s "${DCLOUD_LOGIN_TIMEOUT:-90s}" cli user login \
    --username "$DCLOUD_USERNAME" --password "$DCLOUD_PASSWORD" </dev/null; then
    login_ok=1
    break
  else
    status=$?
    echo "DCloud login attempt $attempt failed (exit $status; 124/137 indicates timeout)"
  fi
  if [ "$attempt" -lt 5 ]; then
    sleep "${DCLOUD_RETRY_DELAY_SECONDS:-10}"
  fi
done
if [ "$login_ok" -ne 1 ]; then
  echo "::error::DCloud login failed after five bounded attempts"
  exit 1
fi

for attempt in 1 2 3; do
  echo "Opening cloud-pack project attempt $attempt/3 (maximum ${DCLOUD_PROJECT_TIMEOUT:-90s})"
  if run_cli timeout -k 5s "${DCLOUD_PROJECT_TIMEOUT:-90s}" cli project open --path "$PROJECT_PATH" </dev/null; then
    echo "DCloud project initialized"
    exit 0
  else
    status=$?
    echo "DCloud project import attempt $attempt failed (exit $status)"
  fi
  if [ "$attempt" -lt 3 ]; then
    # Clear a partially opened project before retrying; this command can hang too.
    run_cli timeout -k 5s "${DCLOUD_PROJECT_CLOSE_TIMEOUT:-15s}" cli project close --path "$PROJECT_PATH" </dev/null || true
    sleep "${DCLOUD_RETRY_DELAY_SECONDS:-10}"
  fi
done
echo "::error::DCloud project initialization failed after three bounded attempts (exit $status)"
exit "$status"
