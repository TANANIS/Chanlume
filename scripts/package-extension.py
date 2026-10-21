"""Package a versioned extension ZIP without overwriting an existing version."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

root = Path(__file__).resolve().parent.parent
source = root / 'extension'
mirror = root / 'outputs/extension'
if json.loads((source / 'dev-reload.json').read_text(encoding='utf-8')).get('chanlumeDevWatch'):
    raise RuntimeError('Stop scripts/dev-watch.ps1 before packaging; a live developer reload marker must never ship')
version = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))['version']
archive = root / 'outputs' / f'Chanlume-{version}.zip'
excluded = {Path('dev-reload.json'), Path('content/dev-reload.js')}
files = sorted(path.relative_to(source) for path in source.rglob('*') if path.is_file() and path.relative_to(source) not in excluded)
extras = {path.relative_to(mirror) for path in mirror.rglob('*') if path.is_file()} - set(files)
if extras:
    raise RuntimeError(f'Unexpected mirror files: {extras}')
if archive.exists():
    raise FileExistsError(f'Version package already exists; preserve it before packaging: {archive}')

def cut_block(content: str, start: str, end: str) -> str:
    if content.count(start) != 1:
        raise RuntimeError(f'Expected exactly one developer start marker: {start}')
    prefix, rest = content.split(start, 1)
    if end not in rest:
        raise RuntimeError(f'Missing developer end marker: {end}')
    return prefix + end + rest.split(end, 1)[1]

def production_content(relative: Path) -> bytes:
    contents = (source / relative).read_bytes()
    if relative == Path('manifest.json'):
        manifest = json.loads(contents)
        for script in manifest['content_scripts']:
            if 'js' in script:
                script['js'] = [name for name in script['js'] if name != 'content/dev-reload.js']
        return (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    if relative == Path('background.js'):
        text = contents.decode('utf-8')
        text = cut_block(text, 'const DEV_RELOAD_FILE = "dev-reload.json";', 'async function readRecentFeed(identity, force = false) {')
        text = cut_block(text, '  if (message?.type === "CHANLUME_DEV_MARKER") {', '  if (message?.type === "CHANLUME_CHANNEL_FEED") {')
        callback = '  if (details.reason === "update") await refreshDevTabsAfterReload();'
        if text.count(callback) != 1:
            raise RuntimeError('Expected one developer update callback')
        text = text.replace(callback, '')
        if any(name in text for name in ('DEV_RELOAD', 'CHANLUME_DEV_', 'refreshDevTabsAfterReload')):
            raise RuntimeError('Developer reload code remained in production')
        previous_archive = root / 'outputs/Chanlume-1.23.3.zip'
        trusted_hash = '1686a281a984f3828e2ca353a2e59ed8683c10e0d7412ed51c79f26f31ef04f2'
        if hashlib.sha256(previous_archive.read_bytes()).hexdigest() != trusted_hash:
            raise RuntimeError('Historical production archive checksum mismatch')
        with zipfile.ZipFile(previous_archive) as verified:
            baseline = verified.read('background.js')
        def normalize_blank_lines(value: str) -> str:
            return re.sub(r'(?m)^[\t ]*\r?\n', '', value).replace('\r\n', '\n')
        if normalize_blank_lines(text) != normalize_blank_lines(baseline.decode('utf-8')):
            raise RuntimeError('Production background differs from the reviewed historical source')
        return baseline
    return contents

payloads = {relative: production_content(relative) for relative in files}
for relative in files:
    target = mirror / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(payloads[relative])
with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED, compresslevel=9) as output:
    for relative in files:
        output.write(mirror / relative, relative.as_posix())
with zipfile.ZipFile(archive) as output:
    assert set(output.namelist()) == {relative.as_posix() for relative in files}
    assert output.testzip() is None
    for relative in files:
        assert payloads[relative] == (mirror / relative).read_bytes() == output.read(relative.as_posix()), relative
print(json.dumps({'kind':'versioned-package','version':version,'files':len(files),'archive':str(archive),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'production_mirror_zip_equal':True,'developer_reload_removed':True}, indent=2))
