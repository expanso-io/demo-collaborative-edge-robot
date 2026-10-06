#!/usr/bin/env -S uv run --offline --no-project
"""Render documented Edge components; coordination is in pipelines/*.blobl."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NODES = {"camera-1": 4101, "mic-1": 4102, "coordinator": 4100,
         "rover-1": 4111, "drone-1": 4121, "drone-2": 4122}


def obj(properties):
    return {"type": "object", "required": list(properties),
            "additionalProperties": False, "properties": properties}


def enum(*values):
    return {"enum": list(values)}


def schema(node):
    station = enum(1, 2, None)
    recognition = obj({"task": enum("card" if node == "camera-1" else "keyword"),
                       "value": station if node == "camera-1" else enum("go", "stop", None),
                       "confidence": {"type": "number", "minimum": 0, "maximum": 1}})
    command = obj({"target": enum(node), "action": enum("move_to", "pause", "resume", "hold"),
                   "station": station})
    state = obj({"phase": enum("idle", "moving", "paused", "arrived"), "station": station,
                 "x": {"type": "number", "minimum": 0, "maximum": 1},
                 "y": {"type": "number", "minimum": 0, "maximum": 1}})
    base = {"v": enum(1), "id": {"type": "string", "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"},
            "ts": {"type": "string", "pattern": "Z$", "format": "date-time"},
            "raw_bytes": {"type": "integer", "minimum": 0},
            "from": enum(node), "kind": enum("recognition"), "body": recognition}
    if node in ("camera-1", "mic-1"):
        return obj(base)
    return {"oneOf": [obj(base | {"from": enum("coordinator"), "kind": enum("command"), "body": command}),
                       obj(base | {"kind": enum("state"), "body": state})]}


def http_output(url):
    return {"http_client": {"url": url, "verb": "POST", "headers": {"Content-Type": "application/json"},
                            "max_in_flight": 1, "timeout": "3s", "retries": 0}}


def bus_branch():
    return {"branch": {"processors": [{"http": {"url": "http://127.0.0.1:4190/events",
                         "verb": "POST", "headers": {"Content-Type": "application/json"},
                         "timeout": "3s", "retries": 0}}]}}


def main():
    for node, port in NODES.items():
        server = {"http_server": {"address": f"127.0.0.1:{port}", "path": "/events",
                  "ws_path": "", "timeout": "5s", "cors": {"enabled": True,
                  "allowed_origins": ["http://127.0.0.1:4180"]}}}
        if node != "coordinator":
            validation = 'root = this.json_schema(' + json.dumps(json.dumps(schema(node))) + ')\n'
            validation += 'root = if content().length() >= 1024 { throw("envelope must be below 1 KB") } else { this }'
            processors = [{"mapping": validation}, {"mapping": 'root = if errored() { deleted() } else { this }'}]
            output = http_output("http://127.0.0.1:4190/events")
            if node in ("camera-1", "mic-1"):
                processors += [bus_branch(), {"mapping": 'root = if errored() { deleted() } else { this }'}]
                output = http_output("http://127.0.0.1:4100/events")
            else:
                processors += [bus_branch(), {"mapping": 'root = if errored() || this.kind == "command" { deleted() } else { this }'}]
                output = http_output("http://127.0.0.1:4100/events")
            config = {"input": server, "pipeline": {"threads": 1, "processors": processors}, "output": output}
        else:
            incoming = {"oneOf": [schema("camera-1"), schema("mic-1"),
                                    *[schema(device)["oneOf"][1] for device in ("rover-1", "drone-1", "drone-2")]]}
            # Keep HTTP validation before the timer merge: clients cannot inject ticks.
            server["processors"] = [{"mapping": 'root = this.json_schema(' + json.dumps(json.dumps(incoming)) + ')'},
                                    {"mapping": 'root = if errored() || content().length() >= 1024 { deleted() } else { this }'}]
            validation = [{"mapping": 'root = if this.tick.or(false) { this } else { this.json_schema(' + json.dumps(json.dumps(incoming)) + ') }'},
                                      {"mapping": 'root = if errored() || content().length() >= 1024 { deleted() } else { this }'}]
            config = {"input": {"broker": {"inputs": [server, {"generate": {"interval": "50ms", "mapping": 'root = {"tick":true}'}}]}},
                      "cache_resources": [{"label": "coordination", "memory": {"compaction_interval": "", "init_values": {
                          "state": json.dumps({"destination": None, "phase": "idle", "reason": "waiting for a card",
                                               "pending": 0, "last_stop": 0, "clear": False})}}}],
                      "pipeline": {"threads": 1, "processors": validation + [
                          {"mapping": 'root.event = this'},
                          {"branch": {"processors": [{"cache": {"resource": "coordination", "operator": "get", "key": "state"}}],
                                      "result_map": 'root.saved = content().string().parse_json()'}},
                          {"mapping": (ROOT / "pipelines/coordinate.blobl").read_text()},
                          {"cache": {"resource": "coordination", "operator": "set", "key": "state", "value": '${! json("saved") }'}},
                          {"mapping": (ROOT / "pipelines/envelopes.blobl").read_text()},
                          {"unarchive": {"format": "json_array"}},
                          {"split": {"size": 1}},
                      ]},
                      "output": http_output('http://127.0.0.1:${! if json("kind") == "decision" {4190} else if json("body.target") == "rover-1" {4111} else if json("body.target") == "drone-1" {4121} else {4122} }/events')}
        path = ROOT / "pipelines" / f"{node}.yaml"
        path.write_text(json.dumps({"name": node, "type": "pipeline", "config": config}, indent=2) + "\n")


if __name__ == "__main__":
    main()
