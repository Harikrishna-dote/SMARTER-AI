import sys
from pathlib import Path
p=Path('logs')
print('logs dir exists:', p.exists())
if not p.exists():
    sys.exit(0)
for f in p.glob('**/*.log'):
    print('---', f)
    print(f.read_text()[:2000])
