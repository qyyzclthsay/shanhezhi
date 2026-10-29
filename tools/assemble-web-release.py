"""Assemble a verified static site from a base release and a small update ZIP."""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path, PurePosixPath

MANIFEST = "_release_manifest.json"


def safe_name(name):
    if not isinstance(name, str) or not name or "\\" in name or ":" in name:
        raise ValueError("Invalid release path")
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or str(path) != name:
        raise ValueError("Unsafe release path: " + name)
    return name


def assemble(base, update, output):
    output = output.resolve()
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        raise ValueError("The release destination must be empty")
    base_bytes = base.read_bytes()
    with zipfile.ZipFile(base) as original, zipfile.ZipFile(update) as patch:
        for archive in (original, patch):
            names = archive.namelist()
            if len(names) != len(set(names)):
                raise ValueError("Duplicate ZIP entries")
            for name in names:
                safe_name(name)
        manifest = json.loads(patch.read(MANIFEST))
        if manifest.get("version") != 1:
            raise ValueError("Unsupported update format")
        if hashlib.sha256(base_bytes).hexdigest() != manifest.get("baseSha256"):
            raise ValueError("Base release hash mismatch; rebuild the update for this base")
        files = manifest["files"]
        names = [safe_name(row["path"]) for row in files]
        if len(names) != len(set(names)) or MANIFEST in names:
            raise ValueError("Duplicate or reserved manifest paths")
        if set(patch.namelist()) - {MANIFEST} - set(names):
            raise ValueError("Update contains files outside the runtime manifest")
        resolved = []
        for row in files:
            name = row["path"]
            archive = patch if name in patch.namelist() else original
            data = archive.read(name)
            if len(data) != row["bytes"] or hashlib.sha256(data).hexdigest() != row["sha256"]:
                raise ValueError("Runtime file verification failed: " + name)
            resolved.append((name, data))
    # Validate everything before creating the site. Obsolete base files are omitted.
    output.mkdir(parents=True, exist_ok=True)
    for name, data in resolved:
        destination = output.joinpath(*PurePosixPath(name).parts)
        if not destination.resolve().is_relative_to(output):
            raise ValueError("Release destination escapes its root")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    return {"files": len(resolved), "bytes": sum(len(data) for _, data in resolved)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", type=Path, default=Path("shanhezhi-v17-web.zip"))
    parser.add_argument("--update", type=Path, default=Path("shanhezhi-web-update.zip"))
    parser.add_argument("--output", type=Path, default=Path("_site"))
    args = parser.parse_args()
    print(json.dumps(assemble(args.base, args.update, args.output)))
