#!/usr/bin/env python3
"""Write reproducible inventories for locally retained course source files."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COURSES = ("cet", "kaoyan-english")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def inventory(course: str) -> None:
    course_dir = ROOT / "content" / course
    raw_dir = course_dir / "raw"
    if not raw_dir.is_dir():
        raise SystemExit(f"Missing raw source directory: {raw_dir}")
    files = []
    for path in sorted(item for item in raw_dir.rglob("*") if item.is_file()):
        files.append({
            "path": path.relative_to(course_dir).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        })
    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "courseId": course,
        "fileCount": len(files),
        "totalBytes": sum(item["bytes"] for item in files),
        "files": files,
    }
    output = course_dir / "source-files.json"
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Inventoried {len(files)} {course} source files ({payload['totalBytes']} bytes).")


def main() -> None:
    for course in COURSES:
        inventory(course)


if __name__ == "__main__":
    main()
