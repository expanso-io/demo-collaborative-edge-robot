#!/usr/bin/env bash
set -euo pipefail

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

: "${EXPANSO_CLI_ENDPOINT:?Set the Expanso Cloud endpoint}"
: "${EXPANSO_CLI_AUTH_API_KEY:?Set the Expanso Cloud API key}"

for pipeline in pipelines/*.yaml; do
  expanso-edge validate "$pipeline"
  expanso-cli job deploy --force "$pipeline"
done
