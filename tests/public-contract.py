"""Check that published records and generated pipelines remain tied to sources."""
from html.parser import HTMLParser
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class Records(HTMLParser):
    def __init__(self):
        super().__init__()
        self.records = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        if tag == 'pre' and 'data-public-json' in dict(attrs):
            self.current = ''

    def handle_data(self, data):
        if self.current is not None:
            self.current += data

    def handle_endtag(self, tag):
        if tag == 'pre' and self.current is not None:
            self.records.append(json.loads(self.current))
            self.current = None

page = Records()
page.feed((ROOT / 'web/example.html').read_text())
expected = []
for node in ('camera-1', 'mic-1', 'coordinator', 'rover-1', 'drone-1', 'drone-2'):
    for suffix in ('input', 'expected'):
        rows = [json.loads(line) for line in (ROOT / f'web/fixtures/{node}.{suffix}.jsonl').read_text().splitlines()]
        expected.append(rows[0] if len(rows) == 1 else rows)
assert page.records == expected, 'Explorer records differ from pipeline fixtures'
coordinator = json.loads((ROOT / 'pipelines/coordinator.yaml').read_text())
processors = coordinator['config']['pipeline']['processors']
for file in ('coordinate.blobl', 'envelopes.blobl'):
    assert {'mapping': (ROOT / 'pipelines' / file).read_text()} in processors, file
assert '127.0.0.1' in coordinator['config']['input']['broker']['inputs'][0]['http_server']['address']
print('PASS published JSON matches all 12 fixtures; coordinator uses original rule sources')

# Retained presenter controls must still exist on their declared route.
features = json.loads((ROOT / 'public-features.json').read_text())
for control in features['controls']:
    source = ROOT / ('web/index.html' if control.get('route') == '/' else 'web/example.html')
    assert f'id="{control["selector"][1:]}"' in source.read_text(), control['id']
print('PASS retained controls exist on presenter and explorer routes')
