set shell := ["bash", "-euo", "pipefail", "-c"]

_default:
    @just --list

# Deploy or update all six pipelines in Expanso Cloud.
up:
    bash scripts/cloud-up.sh

# Start six local nodes and the presenter in the background; retain logs.
up-local:
    uv run --offline --no-project scripts/lifecycle.py up

# Stop this demo's six Cloud jobs.
down:
    bash scripts/cloud-down.sh

# Stop only this checkout's local launcher and verify the demo port range.
down-local:
    uv run --offline --no-project scripts/lifecycle.py down

# Stop the presenter before running checks; the pipeline suite owns its ports.
check:
    uv run --offline --no-project tests/pipelines/run.py
    node --test tests/vision/vision.test.mjs
    node tests/audio/verify.mjs
    node --test tests/stage/adapter.test.mjs
    node --test tests/reveal/accounting.test.js
    uv run --offline --no-project tests/public-contract.py

# Checks need exclusive ports, then leave a fresh presenter ready to record.
record-check: down-local check up-local
    curl -fsS http://127.0.0.1:4180/ > /dev/null
    @echo "RECORD CHECKLIST"
    @echo "  [ ] Light theme, readable projector text, printed cards ready"
    @echo "  [ ] Camera and microphone permissions granted and tested live"
    @echo "  [ ] Fresh stage, destination unset, map adapters ready"
    @echo "  [ ] Stop priority and uncertain-card beat rehearsed"
    @echo "  [ ] Run just down after recording"

recording-preflight:
    @uv run -s ../_demo-kit/recording-preflight.py .

# Install only the pinned check dependencies, then run the shared checker.
public-check:
    npm install --prefix .runtime/public-tools --no-save --ignore-scripts axe-core@4.10.3
    uv run --with playwright==1.55.0 playwright install chromium
    PUBLIC_BAR_AXE_PATH="$PWD/.runtime/public-tools/node_modules/axe-core/axe.min.js" uv run -s .demo-kit/public-bar.py --repo . --manifest public-bar.toml --report artifacts/public-bar.md
