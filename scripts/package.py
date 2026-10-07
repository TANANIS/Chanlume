"""Build and verify the local unpacked mirror and versioned ZIP."""
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

root = Path(__file__).resolve().parent.parent
source = root / "extension"
mirror = root / "outputs" / "extension"
version = json.loads((source / "manifest.json").read_text(encoding="utf-8"))["version"]
archive = root / "outputs" / f"Chanlume-{version}.zip"
files = sorted(path.relative_to(source) for path in source.rglob("*") if path.is_file())
existing = {path.relative_to(mirror) for path in mirror.rglob("*") if path.is_file()}
extras = existing - set(files)
if extras:
    raise RuntimeError(f"Unexpected mirror files; inspect before packaging: {extras}")
for relative in files:
    target = mirror / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source / relative, target)
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as output:
    for relative in files:
        output.write(source / relative, relative.as_posix())
with zipfile.ZipFile(archive) as output:
    assert set(output.namelist()) == {relative.as_posix() for relative in files}
    assert "manifest.json" in output.namelist()
    for relative in files:
        assert (source / relative).read_bytes() == (mirror / relative).read_bytes() == output.read(relative.as_posix()), relative
print(json.dumps({"version": version, "files": len(files), "archive": str(archive), "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(), "source_mirror_zip_equal": True}, indent=2))
