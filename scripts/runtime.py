"""Local process lifecycle and ordered SSE transport. No coordination rules."""
import collections
import functools
import http.server
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / ".runtime"
NODES = {"coordinator": (4100, 4200), "camera-1": (4101, 4201), "mic-1": (4102, 4202),
         "rover-1": (4111, 4203), "drone-1": (4121, 4204), "drone-2": (4122, 4205)}
PORTS = [4180, 4190] + [port for pair in NODES.values() for port in pair]
ORIGIN = "http://127.0.0.1:4180"
PROXYLESS = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def request(url, data=None):
    headers = {"Content-Type": "application/json"}
    with PROXYLESS.open(urllib.request.Request(url, data=data, headers=headers), timeout=3) as response:
        return response.read()


def listening(port):
    with socket.socket() as connection:
        connection.settimeout(.1)
        return connection.connect_ex(("127.0.0.1", port)) == 0


class Bus:
    def __init__(self):
        self.events = collections.deque(maxlen=10000)
        self.condition = threading.Condition()
        self.sequence = 0
        self.closed = False

    def append(self, event):
        with self.condition:
            self.sequence += 1
            self.events.append((self.sequence, event))
            self.condition.notify_all()


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_args):
        pass

    def origin_allowed(self):
        return self.headers.get("Origin") in (None, ORIGIN)

    def reply(self, code, content=b""):
        self.send_response(code)
        if self.headers.get("Origin") == ORIGIN:
            self.send_header("Access-Control-Allow-Origin", ORIGIN)
            self.send_header("Vary", "Origin")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_OPTIONS(self):
        if not self.origin_allowed():
            self.reply(403)
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Last-Event-ID")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self):
        if not self.origin_allowed():
            self.reply(403)
            return
        if self.path != "/events":
            self.reply(404)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size < 1024:
                self.close_connection = True
                self.reply(413)
                return
            payload = self.rfile.read(size)
            event = json.loads(payload)
            if not isinstance(event, dict) or event.get("kind") not in ("recognition", "decision", "command", "state"):
                raise ValueError("invalid envelope")
        except (ValueError, UnicodeError):
            self.reply(400)
            return
        self.server.bus.append(event)
        self.reply(200, b"{}")

    def do_GET(self):
        if not self.origin_allowed():
            self.reply(403)
            return
        if self.path == "/health":
            self.reply(200, b"ready")
            return
        if self.path != "/stream":
            self.reply(404)
            return
        try:
            cursor = int(self.headers.get("Last-Event-ID", "0"))
        except ValueError:
            self.reply(400)
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", ORIGIN)
        self.send_header("Vary", "Origin")
        self.end_headers()
        bus = self.server.bus
        try:
            while not bus.closed:
                with bus.condition:
                    available = [(seq, event) for seq, event in bus.events if seq > cursor]
                    if not available:
                        bus.condition.wait(1)
                if available and cursor and available[0][0] > cursor + 1:
                    self.wfile.write(b"event: gap\ndata: {\"reason\":\"replay buffer exceeded\"}\n\n")
                for seq, event in available:
                    data = json.dumps(event, separators=(",", ":"))
                    self.wfile.write(f"id: {seq}\ndata: {data}\n\n".encode())
                    cursor = seq
                if not available:
                    self.wfile.write(b": heartbeat\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass


def stop():
    record = RUNTIME / "launcher.json"
    if not record.exists():
        print("No launcher recorded for this checkout.")
        return
    info = json.loads(record.read_text())
    result = subprocess.run(["ps", "-p", str(info["pid"]), "-o", "command="], capture_output=True, text=True)
    if str(ROOT / "scripts/runtime.py") not in result.stdout and "scripts/runtime.py" not in result.stdout:
        raise RuntimeError("Recorded PID is no longer the demo launcher; refusing to signal it.")
    os.kill(info["pid"], signal.SIGTERM)
    deadline = time.monotonic() + 20
    while record.exists() and time.monotonic() < deadline:
        time.sleep(.1)
    if record.exists():
        raise RuntimeError("Launcher has not confirmed shutdown.")
    print("Demo stopped.")


def run():
    if not shutil.which("expanso-edge"):
        raise RuntimeError("expanso-edge is required. Install it before running this offline demo.")
    threshold = float(os.environ.get("CONFIDENCE_THRESHOLD", "0.80"))
    if not 0 <= threshold <= 1:
        raise RuntimeError("CONFIDENCE_THRESHOLD must be between 0 and 1.")
    occupied = [port for port in PORTS if listening(port)]
    if occupied:
        raise RuntimeError(f"Ports already in use: {occupied}; stop their owner before starting.")
    os.umask(0o077)
    RUNTIME.mkdir(mode=0o700, exist_ok=True)
    os.chmod(RUNTIME, 0o700)
    record = RUNTIME / "launcher.json"
    # Exclusive create prevents two launchers from racing for the same nodes.
    with record.open("x") as stream:
        json.dump({"pid": os.getpid(), "root": str(ROOT)}, stream)
    children, servers, logs = [], [], []
    stopping = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: stopping.set())
    signal.signal(signal.SIGINT, lambda *_: stopping.set())
    bus = Bus()
    try:
        bus_server = http.server.ThreadingHTTPServer(("127.0.0.1", 4190), Handler)
        bus_server.bus = bus
        servers.append(bus_server)
        static = http.server.ThreadingHTTPServer(("127.0.0.1", 4180), functools.partial(
            http.server.SimpleHTTPRequestHandler, directory=str(ROOT / "web")))
        servers.append(static)
        for server in servers:
            threading.Thread(target=server.serve_forever, daemon=True).start()
        # Remove inherited service settings; local mode has no credential requirement.
        env = {key: value for key, value in os.environ.items() if not key.startswith("EXPANSO_")}
        env["CONFIDENCE_THRESHOLD"] = str(threshold)
        for node, (_, api) in NODES.items():
            data = RUNTIME / node
            data.mkdir(mode=0o700, exist_ok=True)
            log = (RUNTIME / f"{node}.log").open("w")
            logs.append(log)
            children.append(subprocess.Popen([
                "expanso-edge", "run", "--local", "--no-watch", "--config", str(ROOT / "config/local.yaml"),
                "--name", node, "--data-dir", str(data), "--api-listen", f"127.0.0.1:{api}"],
                cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT))
        deadline = time.monotonic() + 20
        while not all(listening(api) for _, api in NODES.values()):
            if stopping.wait(.1) or any(child.poll() is not None for child in children) or time.monotonic() > deadline:
                raise RuntimeError("Edge startup failed; inspect .runtime/*.log")
        for node, (_, api) in NODES.items():
            spec = (ROOT / "pipelines" / f"{node}.yaml").read_bytes()
            request(f"http://127.0.0.1:{api}/api/v1/jobs", spec)
        deadline = time.monotonic() + 20
        while not all(listening(port) for port, _ in NODES.values()):
            if stopping.wait(.1) or time.monotonic() > deadline:
                raise RuntimeError("Pipeline startup failed; inspect .runtime/*/executions and node logs")
        print(f"Ready: {ORIGIN}/ (six offline Edge nodes; threshold {threshold:.2f})", flush=True)
        while not stopping.wait(.25):
            if any(child.poll() is not None for child in children):
                raise RuntimeError("An Edge node exited; stopping the demo. Inspect .runtime/*.log")
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
        bus.closed = True
        with bus.condition:
            bus.condition.notify_all()
        for server in servers:
            server.shutdown()
            server.server_close()
        for log in logs:
            log.close()
        record.unlink(missing_ok=True)
        lingering = [port for port in PORTS if listening(port)]
        if lingering:
            raise RuntimeError(f"Ports remain occupied after shutdown: {lingering}")
        print("Stopped: all demo ports are free.", flush=True)


if __name__ == "__main__":
    try:
        stop() if "--stop" in sys.argv else run()
    except Exception as error:
        print(f"Demo error: {error}", file=sys.stderr)
        sys.exit(1)
