"""Background lifecycle used by just up and just down."""
import argparse
import os
from pathlib import Path
import signal
import subprocess
import time
import runtime

ROOT = Path(__file__).resolve().parents[1]


def down():
    runtime.stop()
    occupied = [port for port in sorted(set(range(4100, 4200)) | set(runtime.PORTS))
                if runtime.listening(port)]
    if occupied:
        raise RuntimeError(f'Ports still listening: {occupied}; stop their owner explicitly.')
    print('PASS ports 4100-4199 and all six Edge APIs are free.')


def up():
    record = runtime.RUNTIME / 'launcher.json'
    if record.exists():
        raise RuntimeError('A launcher is recorded. Use just down before just up.')
    occupied = [port for port in runtime.PORTS if runtime.listening(port)]
    if occupied:
        raise RuntimeError(f'Ports already in use: {occupied}; refusing to start.')
    runtime.RUNTIME.mkdir(mode=0o700, exist_ok=True)
    ready = runtime.RUNTIME / 'ready'
    ready.unlink(missing_ok=True)
    log_path = runtime.RUNTIME / 'launcher.log'
    with log_path.open('w') as log:
        child = subprocess.Popen([str(ROOT / 'scripts/run')], cwd=ROOT,
                                 stdin=subprocess.DEVNULL, stdout=log,
                                 stderr=subprocess.STDOUT, start_new_session=True)
    try:
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            if child.poll() is not None:
                raise RuntimeError(f'Launcher exited: {log_path.read_text()[-4000:]}')
            if ready.exists():
                runtime.request('http://127.0.0.1:4180/')
                print('Ready: http://127.0.0.1:4180/')
                print('Explorer: http://127.0.0.1:4180/example.html')
                print('Log: .runtime/launcher.log; stop with just down')
                return
            time.sleep(.1)
        raise RuntimeError(f'Startup timed out. Inspect {log_path}')
    except BaseException:
        if record.exists():
            runtime.stop()
        elif child.poll() is None:
            os.killpg(child.pid, signal.SIGTERM)
        try:
            child.wait(timeout=20)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            child.wait()
        raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('up', 'down'))
    args = parser.parse_args()
    up() if args.action == 'up' else down()
