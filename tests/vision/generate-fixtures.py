"""Reproducible synthetic optics fixtures; these are not camera photographs.
Run with: uv run --no-project --with pillow tests/vision/generate-fixtures.py
Requires rsvg-convert. The committed fixtures need no Python at test time.
"""
from pathlib import Path
import io
import json
import subprocess
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tests/vision'
DIGITS = {
    1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
}
manifest = []
for digit, rows in DIGITS.items():
    blocks = []
    for y, row in enumerate(rows):
        for x, cell in enumerate(row):
            if cell == '1':
                blocks.append(f'<rect x="{200+x*120}" y="{150+y*100}" width="120" height="100"/>')
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" '
           'viewBox="0 0 210 297"><title>Station '+str(digit)+'</title>'
           '<rect width="210" height="297" fill="white"/>'
           '<g transform="translate(10 48.5) scale(.19)" fill="black">'
           '<path fill-rule="evenodd" d="M0 0H1000V1000H0Z M55 55V945H945V55Z"/>'
           + ''.join(blocks) + '</g></svg>\n')
    path = ROOT / f'docs/cards/card-{digit}.svg'
    path.write_text(svg)
    png = subprocess.check_output(['rsvg-convert', '-w', '840', str(path)])
    card = Image.open(io.BytesIO(png)).convert('RGB')
    # Extract the actual printable ink square, not a separate recognizer template.
    square = card.crop((40, 194, 800, 954))
    square.save(OUT / f'card-{digit}-print.png')
    def scene(size, x=220, y=100):
        image = Image.new('RGB', (640, 480), (164, 168, 172))
        paper = Image.new('RGB', (size+20, size+20), 'white')
        paper.paste(square.resize((size, size), Image.Resampling.LANCZOS), (10, 10))
        image.paste(paper, (x-10, y-10))
        return image
    cases = {'clear': scene(240, 180, 90), 'distance': scene(68, 285, 200)}
    # Pillow inverse perspective mapping, independent of the JS corner solver.
    cases['angle'] = scene(220, 185, 120).transform((640, 480), Image.Transform.PERSPECTIVE,
        (1.08, 0.13, -30, -0.08, 1.02, 25, 0.00035, -0.00012), Image.Resampling.BICUBIC,
        fillcolor=(164, 168, 172))
    cases['angle-distance'] = scene(82, 275, 185).transform((640, 480), Image.Transform.PERSPECTIVE,
        (1.08, 0.13, -30, -0.08, 1.02, 25, 0.00035, -0.00012), Image.Resampling.BICUBIC,
        fillcolor=(164, 168, 172))
    covered = cases['clear'].copy()
    ImageDraw.Draw(covered).rectangle((225, 150, 370, 220), fill=(208, 165, 130))
    cases['partly-covered'] = covered
    covered_all = cases['clear'].copy()
    ImageDraw.Draw(covered_all).rectangle((220, 120, 380, 300), fill='white')
    cases['covered-digit'] = covered_all
    cases['blurred'] = cases['distance'].filter(ImageFilter.GaussianBlur(3))
    cases['dim'] = cases['clear'].point(lambda channel: int(channel * .55))
    for name, image in cases.items():
        file = f'card-{digit}-{name}.ppm'
        image.save(OUT / file)
        good = name not in ('partly-covered', 'covered-digit', 'blurred')
        manifest.append({'file': file, 'value': digit if good else None,
                         'min': .8 if good else 0, 'max': 1 if good else .799})
blank = Image.new('RGB', (640, 480), (220, 220, 220))
blank.save(OUT / 'blank.ppm')
manifest.append({'file': 'blank.ppm', 'value': None, 'min': 0, 'max': .799})
(OUT / 'fixtures.json').write_text(json.dumps(manifest, indent=2)+'\n')
