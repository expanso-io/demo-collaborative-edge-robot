#!/usr/bin/env -S uv run --offline --no-project
"""Serve the separate explorer or the existing local event bus for CI fixtures."""
import argparse
import functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import runtime

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--bus', action='store_true', help='serve the real event bus on 4190')
args = parser.parse_args()
if args.bus:
    server = ThreadingHTTPServer(('127.0.0.1', 4190), runtime.Handler)
    server.bus = runtime.Bus()
else:
    handler = functools.partial(SimpleHTTPRequestHandler,
                                directory=str(Path(__file__).resolve().parents[1] / 'web'))
    server = ThreadingHTTPServer(('127.0.0.1', 4180), handler)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
