#!/usr/bin/env bash
set -euo pipefail
: "${HX_VERSION:?Set HX_VERSION}"
: "${HX_SHA256:?Set HX_SHA256 for the HBuilderX Linux archive}"
: "${VITE_SERVER_URL:?Set VITE_SERVER_URL}"
[[ "$HX_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Invalid HX_VERSION'; exit 1; }
[[ "$HX_SHA256" =~ ^[a-fA-F0-9]{64}$ ]] || { echo 'Invalid HX_SHA256'; exit 1; }
[[ "$TARGET_NAME" =~ ^[a-z0-9-]{1,40}$ ]] || { echo 'Invalid native target'; exit 1; }
cd "$GITHUB_WORKSPACE"
export PROJECT_PATH="$GITHUB_WORKSPACE/apps/app"
export SIGNING_DIR="$RUNNER_TEMP/native-signing-$TARGET_NAME"
[[ "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" -gt 0 && "$GITHUB_RUN_ATTEMPT" -lt 1000 ]] || { echo 'Invalid run attempt'; exit 1; }
export VERSION_NAME="1.0.$GITHUB_RUN_NUMBER"
export VERSION_CODE="$((GITHUB_RUN_NUMBER * 1000 + GITHUB_RUN_ATTEMPT))"
export VITE_APP_VERSION="$VERSION_NAME"
export VITE_DEPLOY_ENV=production
export VITE_PRIVACY_URL="${PRIVACY_URL:?Set PRIVACY_URL}"
export VITE_AGREEMENT_URL="${AGREEMENT_URL:?Set AGREEMENT_URL}"
export VITE_LEGAL_VERSION="${LEGAL_VERSION:?Set LEGAL_VERSION}"
cleanup() {
  local status=$?
  set +e
  if [[ -f pack_output.log ]]; then
    PYTHONPATH=scripts/native python3 -c 'import os; from pathlib import Path; from redact import public_log, sensitive_values; Path("result/public_pack.log").write_text(public_log(Path("pack_output.log").read_text(), sensitive_values(os.environ["SIGNING_DIR"] + "/pack-config.json")))'
  fi
  rm -rf "$SIGNING_DIR"
  rm -f pack_output.log
  exit "$status"
}
# Ignore stale local artifacts and diagnostics from previous self-hosted runs.
rm -rf result dist
rm -f pack_output.log
trap cleanup EXIT
python3 scripts/native/legal_config.py
mkdir -p "$RUNNER_TEMP/hbuilderx" result
curl --fail --location --retry 3 --connect-timeout 30 --max-time 300 \
  "https://download1.dcloud.net.cn/download/HBuilderX.${HX_VERSION}.linux_x64.full.tar.gz" \
  -o "$RUNNER_TEMP/hbuilderx.tar.gz"
printf '%s  %s\n' "$HX_SHA256" "$RUNNER_TEMP/hbuilderx.tar.gz" | sha256sum --check --status
tar -xzf "$RUNNER_TEMP/hbuilderx.tar.gz" -C "$RUNNER_TEMP/hbuilderx"
CLI_BIN_PATH=$(find "$RUNNER_TEMP/hbuilderx" -type f -name cli -executable -print -quit)
[[ -n "$CLI_BIN_PATH" ]] || { echo 'HBuilderX cli was not found'; exit 1; }
export PATH="$(dirname "$CLI_BIN_PATH"):$PATH"
python3 scripts/native/prepare_pack.py
pnpm --dir apps/app build:custom app
bash scripts/native/initialize_cloud_project.sh
python3 scripts/native/run_cloud_pack.py --config "$SIGNING_DIR/pack-config.json"
python3 scripts/native/collect_app_package.py --platform "$PACK_PLATFORM"
python3 scripts/native/build_metadata.py
