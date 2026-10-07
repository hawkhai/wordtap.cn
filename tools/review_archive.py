"""Read immutable review history from loose JSON or a lossless ZIP archive."""
from __future__ import annotations

import io
import hashlib
import json
import re
import zipfile
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=2)
def _archive(path: str, size: int, modified: int) -> zipfile.ZipFile:
    # Memory-backed ZIP avoids holding a Windows file lock during future compaction.
    archive = zipfile.ZipFile(io.BytesIO(Path(path).read_bytes()))
    names = archive.namelist()
    if len(names) != len(set(names)) or any(not re.fullmatch(r"[a-f0-9]{64}\.json", name) for name in names):
        raise ValueError("Invalid or duplicate review history archive members")
    return archive


def _history_archive(path: Path):
    if path.parent.name != "history" or not re.fullmatch(r"[a-f0-9]{64}\.json", path.name):
        return None
    archive_path = path.parent.with_suffix(".zip")
    if not archive_path.is_file():
        return None
    stat = archive_path.stat()
    return _archive(str(archive_path.resolve()), stat.st_size, stat.st_mtime_ns)


def evidence_exists(path: Path) -> bool:
    if path.is_file():
        return True
    archive = _history_archive(path)
    return archive is not None and path.name in archive.NameToInfo


def evidence_bytes(path: Path) -> bytes:
    if path.is_file():
        return path.read_bytes()
    archive = _history_archive(path)
    if archive is not None:
        try:
            return archive.read(path.name)
        except KeyError:
            pass
    raise FileNotFoundError(path)


def evidence_json(path: Path):
    return json.loads(evidence_bytes(path).decode("utf-8-sig"))


def compact_history(root: Path) -> dict:
    """Pack exact bytes; remove loose files only after every member is verified."""
    root = root.resolve()
    history = root / "history"
    if history.is_symlink():
        raise ValueError("History directory must not be a symlink")
    target = root / "history.zip"
    members = {}
    if target.exists():
        with zipfile.ZipFile(target) as archive:
            for info in archive.infolist():
                if info.filename in members:
                    raise ValueError("Duplicate history member")
                members[info.filename] = archive.read(info)
    loose = sorted(history.glob("*.json"))
    for path in loose:
        if path.is_symlink() or path.resolve().parent != history:
            raise ValueError("Loose history path escaped the review directory")
        raw = path.read_bytes()
        if path.name in members and members[path.name] != raw:
            raise ValueError("Loose and packed history bytes conflict")
        members[path.name] = raw
    for name, raw in members.items():
        if not re.fullmatch(r"[a-f0-9]{64}\.json", name):
            raise ValueError("Invalid history member name")
        value = json.loads(raw.decode("utf-8-sig"))
        canonical = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        if hashlib.sha256(canonical).hexdigest() != name[:-5]:
            raise ValueError("History member content hash mismatch")
    if not members:
        raise ValueError("No review history to compact")
    temporary = root / "history.zip.tmp"
    with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, raw in sorted(members.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, raw, compresslevel=9)
    with zipfile.ZipFile(temporary) as archive:
        if set(archive.namelist()) != set(members) or any(archive.read(name) != raw for name, raw in members.items()):
            raise ValueError("Packed history verification failed; loose files retained")
    if target.exists() and target.read_bytes() == temporary.read_bytes():
        temporary.unlink()
    else:
        temporary.replace(target)
    for path in loose:
        # Recheck immediately before deletion in case a reviewer wrote concurrently.
        if path.resolve().parent != history or path.read_bytes() != members[path.name]:
            raise ValueError("Loose history changed during compaction; retained")
        path.unlink()
    if history.exists() and not any(history.iterdir()):
        history.rmdir()
    return {"entries": len(members), "uncompressedBytes": sum(map(len, members.values())),
            "archiveBytes": target.stat().st_size, "archiveSha256": hashlib.sha256(target.read_bytes()).hexdigest()}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compact", action="store_true", required=True)
    parser.parse_args()
    print(json.dumps(compact_history(Path(__file__).resolve().parents[1] / "content/article-review")))
