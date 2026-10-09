#!/usr/bin/env bash
set -euo pipefail

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

: "${EXPANSO_CLI_ENDPOINT:?Set the Expanso Cloud endpoint}"
: "${EXPANSO_CLI_AUTH_API_KEY:?Set the Expanso Cloud API key}"

uv run --offline --no-project scripts/render-ports.py
for pipeline in .runtime/jobs/*.yaml; do
  expanso-edge validate "$pipeline"
  expanso-cli job deploy --force "$pipeline"
done
