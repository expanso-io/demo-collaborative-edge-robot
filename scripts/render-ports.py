"""Render allocated Cloud definitions without changing checked templates."""
import json
from pathlib import Path
from port_assignments import mapped
ROOT = Path(__file__).resolve().parents[1]
target = ROOT / ".runtime/jobs"
target.mkdir(parents=True, exist_ok=True)
for source in (ROOT / "pipelines").glob("*.yaml"):
    (target / source.name).write_text(json.dumps(mapped(json.loads(source.read_text())), indent=2) + "\n")
