"""Sticky allocation and complete export without starting a Cloud runtime."""
import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("port_runner", ROOT / "scripts/port-run.py")
RUNNER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUNNER)


class Ports(unittest.TestCase):
    def test_down_up_preserves_every_service_and_presenter(self):
        scratch = ROOT / ".runtime"
        scratch.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as directory:
            env = dict(os.environ, DEMO_PORT_STATE=str(Path(directory) / "state.json"))
            command = ["uv", "run", "--no-project", str(ROOT / "scripts/demo-ports.py"), "resolve", "--demo-dir", str(ROOT), "--format", "json"]
            first = json.loads(subprocess.check_output(command, env=env, text=True))
            presenter = next(value for key, value in first.items() if key.endswith("DASHBOARD_PORT"))
            with socket.socket() as listener:
                listener.bind(("127.0.0.1", presenter))
                listener.listen()
                self.assertEqual(first, json.loads(subprocess.check_output(command + ["--allow-bound"], env=env, text=True)))
                with self.assertRaises(subprocess.CalledProcessError):
                    subprocess.check_output(command, env=env, text=True, stderr=subprocess.PIPE)
            self.assertEqual(first, json.loads(subprocess.check_output(command, env=env, text=True)))

    def test_every_arbitrary_service_is_exported_before_runtime_import(self):
        manifest = json.loads((ROOT / "ports.json").read_text())["ports"]
        arbitrary = {key: 33000 + index * 3 for index, key in enumerate(manifest)}
        with patch.object(sys, "argv", ["port-run.py", "read", "fixture"]), patch.object(RUNNER.subprocess, "check_output", return_value=json.dumps(arbitrary)), patch.object(RUNNER.os, "execvpe") as launch:
            RUNNER.main()
            argv, command, env = launch.call_args.args
            self.assertEqual(argv, "fixture")
            for key, value in arbitrary.items():
                self.assertEqual(env[key], str(value))
            if "SPACE_FORCE_SINK_PORT" in arbitrary:
                self.assertEqual(env["SPACE_FORCE_SINK_PRIORITY"], f"http://127.0.0.1:{arbitrary['SPACE_FORCE_SINK_PORT']}/ingest/priority")


    def test_browser_configuration_and_cloud_jobs_share_arbitrary_ports(self):
        import importlib
        import re
        import threading
        import urllib.request
        from http.server import ThreadingHTTPServer
        sys.path.insert(0, str(ROOT / "scripts"))
        import runtime
        from port_assignments import mapped
        manifest = json.loads((ROOT / "ports.json").read_text())["ports"]
        values = {name: str(33000 + index * 3) for index, name in enumerate(manifest)}
        with patch.dict(os.environ, values):
            importlib.reload(runtime)
            self.assertEqual(runtime.BOARD_PORT, int(values["ROBOT_DASHBOARD_PORT"]))
            self.assertEqual(runtime.BUS_PORT, int(values["ROBOT_BUS_PORT"]))
            for node, (ingest, api) in runtime.NODES.items():
                self.assertIn(ingest, map(int, values.values()))
                self.assertIn(api, map(int, values.values()))
            server = ThreadingHTTPServer(("127.0.0.1", 0), runtime.PresenterHandler)
            thread = threading.Thread(target=server.serve_forever)
            thread.start()
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{server.server_port}/port-config.js") as response:
                    module = response.read().decode()
                self.assertIn(values["ROBOT_BUS_PORT"], module)
                self.assertIn(values["ROBOT_SERVICE_4101_PORT"], module)
            finally:
                server.shutdown()
                server.server_close()
                thread.join()
            for path in (ROOT / "pipelines").glob("*.yaml"):
                job = mapped(json.loads(path.read_text()))
                used = set(re.findall(r"127\.0\.0\.1:([0-9]+)", json.dumps(job)))
                self.assertTrue(used <= set(values.values()))
        importlib.reload(runtime)


if __name__ == "__main__":
    unittest.main()
