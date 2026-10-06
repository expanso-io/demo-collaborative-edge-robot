#!/usr/bin/env bash
set -euo pipefail

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

: "${EXPANSO_CLI_ENDPOINT:?Set the Expanso Cloud endpoint}"
: "${EXPANSO_CLI_AUTH_API_KEY:?Set the Expanso Cloud API key}"

for job in camera-1 coordinator drone-1 drone-2 mic-1 rover-1; do
  expanso-cli job stop "$job" --force || true
done
