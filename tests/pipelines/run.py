#!/usr/bin/env -S uv run --offline --no-project
"""Exercise real Edge jobs and their public HTTP/SSE contract, then stop them."""
import datetime
import importlib.util
import json
from pathlib import Path
import signal
import subprocess
import threading
import time
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("runtime", ROOT / "scripts/runtime.py")
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)
FIXTURES = json.loads((Path(__file__).parent / "fixtures.json").read_text())
events = []
condition = threading.Condition()
stream = None


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def read_stream():
    global stream
    stream = runtime.PROXYLESS.open("http://127.0.0.1:4190/stream", timeout=5)
    seq = 0
    try:
        for raw in stream:
            line = raw.decode().strip()
            if line.startswith("id: "):
                seq = int(line[4:])
            if line.startswith("data: "):
                with condition:
                    events.append((seq, json.loads(line[6:]), time.monotonic()))
                    condition.notify_all()
    except (OSError, ValueError):
        pass


def wait_for(predicate, after=0, timeout=4):
    deadline = time.monotonic() + timeout
    with condition:
        while time.monotonic() < deadline:
            for item in events[after:]:
                if predicate(item[1]):
                    return item
            condition.wait(.05)
    raise AssertionError(f"Expected event not found; observed: {[event[1] for event in events[after:]]}")


def post(name, **overrides):
    fixture = FIXTURES[name] | overrides
    event = {"v": 1, "id": str(uuid.uuid4()), "ts": stamp(), "from": fixture["device"],
             "kind": "recognition", "body": {key: fixture[key] for key in ("task", "value", "confidence")},
             "raw_bytes": fixture["raw_bytes"]}
    index = len(events)
    port = runtime.NODES[event["from"]][0]
    browser_post(port, event)
    wait_for(lambda item: item["id"] == event["id"], index)
    return index


def browser_post(port, event):
    request = urllib.request.Request(f"http://127.0.0.1:{port}/events", data=json.dumps(event).encode(),
                                     headers={"Content-Type": "text/plain", "Origin": runtime.ORIGIN})
    with runtime.PROXYLESS.open(request, timeout=3) as response:
        assert response.headers["Access-Control-Allow-Origin"] == runtime.ORIGIN
        assert response.status == 200


def decision(phase, destination, after, reason=None):
    return wait_for(lambda event: event["kind"] == "decision" and event["body"]["phase"] == phase
                    and event["body"]["destination"] == destination
                    and (reason is None or reason in event["body"]["reason"]), after)


def commands(action, station, after):
    for target in ("rover-1", "drone-1", "drone-2"):
        wait_for(lambda event: event["kind"] == "command" and event["body"] == {
            "target": target, "action": action, "station": station}, after)


def no_moves(after, duration=1.7):
    time.sleep(duration)
    assert not any(event["kind"] == "command" and event["body"]["action"] in ("move_to", "resume")
                   for _, event, _ in events[after:]), "Unexpected movement"


def check(label):
    print(f"PASS {label}", flush=True)


def exercise():
    index = post("go")
    decision("ready", None, index, "no destination yet")
    no_moves(index)
    check("go without destination waits")

    index = post("boundary")
    decision("ready", 1, index)
    commands("hold", 1, index)
    check("confidence boundary 0.80 selects station 1")

    index = post("go")
    # Continuous camera recognition must not cancel the pending go.
    for _ in range(4):
        time.sleep(.15)
        post("card1")
    moving = decision("moving", 1, index)
    commands("move_to", 1, index)
    recognition = next(item for item in events[index:] if item[1]["kind"] == "recognition" and item[1]["from"] == "mic-1")
    assert moving[2] - recognition[2] >= 1.45, "go bypassed the stop window"
    check("go moves all three devices after window; repeated cards do not interrupt")

    index = post("stop")
    decision("paused", 1, index, "stop wins")
    commands("pause", 1, index)
    post("go")
    no_moves(index)
    check("stop pauses all devices, retains destination, beats following go")

    index = post("go")
    decision("moving", 1, index)
    commands("move_to", 1, index)
    check("later go resumes toward retained destination")

    index = post("go")
    time.sleep(.2)
    post("stop")
    decision("paused", 1, index)
    commands("pause", 1, index)
    no_moves(index)
    check("stop cancels preceding go inside 1.5 seconds")

    index = post("below")
    decision("uncertain", 1, index, "confidence")
    commands("hold", 1, index)
    post("go")
    no_moves(index)
    check("below threshold waits, holds devices, preserves station, blocks go")

    index = post("unclear")
    decision("uncertain", 1, index)
    commands("hold", 1, index)
    index = post("card2")
    decision("ready", 2, index)
    commands("hold", 2, index)
    index = post("go")
    decision("moving", 2, index)
    commands("move_to", 2, index)
    check("unreadable input waits; new confident card replaces destination")

    for device in ("rover-1", "drone-1", "drone-2"):
        event = {"v": 1, "id": str(uuid.uuid4()), "ts": stamp(), "from": device, "kind": "state",
                 "body": {"phase": "arrived", "station": 2, "x": .75, "y": .4}, "raw_bytes": 0}
        index = len(events)
        browser_post(runtime.NODES[device][0], event)
        wait_for(lambda item: item["id"] == event["id"], index)
    check("all actuator state envelopes reach bus")

    index = len(events)
    invalid = {"v": 1, "id": str(uuid.uuid4()), "ts": stamp(), "from": "camera-1", "kind": "recognition",
               "body": {"task": "card", "value": 1, "confidence": 1.2}, "raw_bytes": 1}
    runtime.request("http://127.0.0.1:4101/events", json.dumps(invalid).encode())
    invalid["body"]["confidence"] = .9
    invalid["from"] = "mic-1"
    runtime.request("http://127.0.0.1:4101/events", json.dumps(invalid).encode())
    invalid["from"] = "camera-1"
    invalid["raw_frame"] = "x" * 2048
    runtime.request("http://127.0.0.1:4101/events", json.dumps(invalid).encode())
    time.sleep(.15)
    assert len(events) == index, "Invalid envelopes reached bus"
    check("schema, device identity, raw payload and confidence validation")

    check("presenter origin simple text/plain CORS requests on device endpoints")

    assert [seq for seq, _, _ in events] == list(range(1, len(events) + 1)), "SSE order has gaps"
    assert len({event["id"] for _, event, _ in events}) == len(events), "Duplicate envelopes"
    for _, event, _ in events:
        assert len(json.dumps(event).encode()) < 1024
        assert event["ts"].endswith("Z")
        assert set(event) == {"v", "id", "ts", "from", "kind", "body", "raw_bytes"}
    check(f"ordered SSE: {len(events)} unique UTC envelopes, each below 1 KB")


def main():
    assert not any(runtime.listening(port) for port in runtime.PORTS), "Stop existing demo before tests"
    runtime.RUNTIME.mkdir(mode=0o700, exist_ok=True)
    with (runtime.RUNTIME / "fixture-launch.log").open("w") as log:
        process = subprocess.Popen([str(ROOT / "scripts/run")], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
        try:
            deadline = time.monotonic() + 35
            while not (runtime.RUNTIME / "ready").exists():
                if process.poll() is not None or time.monotonic() > deadline:
                    raise AssertionError((runtime.RUNTIME / "fixture-launch.log").read_text())
                time.sleep(.1)
            threading.Thread(target=read_stream, daemon=True).start()
            exercise()
        finally:
            process.send_signal(signal.SIGINT)
            process.wait(timeout=20)
            if stream:
                stream.close()
        assert process.returncode == 0, (runtime.RUNTIME / "fixture-launch.log").read_text()
        assert not any(runtime.listening(port) for port in runtime.PORTS), "Ports remain after shutdown"
        assert not (runtime.RUNTIME / "launcher.json").exists()
        check("Ctrl-C shutdown releases every declared port")


if __name__ == "__main__":
    main()
