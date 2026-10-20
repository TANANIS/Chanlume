"""Package a versioned extension ZIP without overwriting an existing version."""
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

root = Path(__file__).resolve().parent.parent
source = root / 'extension'
mirror = root / 'outputs/extension'
version = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))['version']
archive = root / 'outputs' / f'Chanlume-{version}.zip'
files = sorted(path.relative_to(source) for path in source.rglob('*') if path.is_file())
extras = {path.relative_to(mirror) for path in mirror.rglob('*') if path.is_file()} - set(files)
if extras:
    raise RuntimeError(f'Unexpected mirror files: {extras}')
if archive.exists():
    raise FileExistsError(f'Version package already exists; preserve it before packaging: {archive}')
for relative in files:
    target = mirror / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source / relative, target)
with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED, compresslevel=9) as output:
    for relative in files:
        output.write(source / relative, relative.as_posix())
with zipfile.ZipFile(archive) as output:
    assert set(output.namelist()) == {relative.as_posix() for relative in files}
    assert output.testzip() is None
    for relative in files:
        assert (source / relative).read_bytes() == (mirror / relative).read_bytes() == output.read(relative.as_posix()), relative
print(json.dumps({'kind':'versioned-package','version':version,'files':len(files),'archive':str(archive),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'source_mirror_zip_equal':True}, indent=2))
