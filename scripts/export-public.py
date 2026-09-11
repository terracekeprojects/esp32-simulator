"""Create a fresh public source distribution, excluding private history and inputs."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parent.parent
output = root / '.release' / 'esplab-public-source.zip'
output.parent.mkdir(exist_ok=True)
folders = ['app', 'components', 'lib', 'public', 'tests', 'scripts']
root_files = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts',
              'next-env.d.ts', 'components.json', 'postcss.config.mjs', 'README.md', '.gitignore']
files = [root / f for f in root_files if (root / f).is_file()]
for folder in folders:
    files.extend(p for p in (root / folder).rglob('*') if p.is_file())
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for p in files:
        rel = p.relative_to(root).as_posix()
        if p.is_symlink() or rel == 'lib/private-vault.generated.ts':
            continue
        if 'luxot-source' in rel or 'luxot-firmware' in rel or rel.endswith('.map'):
            raise RuntimeError('Private or debug artifact found in public tree: ' + rel)
        data = p.read_bytes()
        if p.suffix in ['.ts', '.tsx', '.ps1', '.md']:
            data = data.replace(b'https://esplab-interactive-atlas.luxot671.chatgpt.site', b'https://your-site.example')
        archive.writestr(rel, data)
    archive.writestr('lib/private-vault.generated.ts', 'export const vault: string = "";\n')
    archive.writestr('.openai/hosting.json', json.dumps({'project_id': '', 'd1': None, 'r2': None}))
print('Public source export created:', output)
