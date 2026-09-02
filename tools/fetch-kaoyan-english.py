#!/usr/bin/env python3
"""Fetch the public source archives used by the Kaoyan English generator."""

from __future__ import annotations

import hashlib
import json
import shutil
import urllib.request
from urllib.parse import quote
import zipfile
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "content" / "kaoyan-english" / "raw"
MANIFEST = ROOT / "content" / "kaoyan-english" / "source-manifest.json"
BASE_SOURCES = (
    {
        "id": "swjtuhub-english-1",
        "url": "https://raw.githubusercontent.com/swjtuhub/SWJTU-Courses/main/%E8%80%83%E7%A0%94%E8%B5%84%E6%96%99/%E8%8B%B1%E8%AF%AD/%E7%9C%9F%E9%A2%98/%E8%8B%B1%E8%AF%AD%E4%B8%80%E7%9C%9F%E9%A2%98.zip",
        "file": "english-1.zip",
        "archive": True,
        "sourcePage": "https://swjtuhub.cn/%E8%80%83%E7%A0%94%E8%B5%84%E6%96%99/%E8%8B%B1%E8%AF%AD/",
    },
    {
        "id": "swjtuhub-english-2",
        "url": "https://raw.githubusercontent.com/swjtuhub/SWJTU-Courses/main/%E8%80%83%E7%A0%94%E8%B5%84%E6%96%99/%E8%8B%B1%E8%AF%AD/%E7%9C%9F%E9%A2%98/%E8%8B%B1%E8%AF%AD%E4%BA%8C%E7%9C%9F%E9%A2%98.zip",
        "file": "english-2.zip",
        "archive": True,
        "sourcePage": "https://swjtuhub.cn/%E8%80%83%E7%A0%94%E8%B5%84%E6%96%99/%E8%8B%B1%E8%AF%AD/",
    },
    {
        "id": "bjcugb-english-2-2010-2016",
        "url": "https://bjcugb.com/forum.php?mod=attachment&aid=MTA2NXwyZWIyODA1YnwxNzg1NjA1OTIwfDB8ODEyNw%3D%3D",
        "file": "english-2-2010-2016.pdf",
        "archive": False,
        "sourcePage": "https://bjcugb.com/forum.php?mod=viewthread&tid=8127",
    },
)


def recent_source(group_id: str, year: int) -> dict[str, object]:
    slug = "english-one" if group_id == "e1" else "english-two"
    chinese_group = "一" if group_id == "e1" else "二"
    pdf_name = quote(f"考研英语{chinese_group}{year}年真题（整卷）.pdf")
    return {
        "id": f"lazynote-{group_id}-{year}",
        "url": f"https://english-exam.lazynote.cn/downloads/kaoyan/{year}-{slug}/{pdf_name}",
        "file": f"recent/{group_id}-{year}.pdf",
        "archive": False,
        "sourcePage": f"https://english-exam.lazynote.cn/kaoyan/paper/{year}-{slug}/",
    }


SOURCES = BASE_SOURCES + tuple(
    recent_source(group_id, year)
    for group_id, years in (("e1", range(2021, 2027)), ("e2", range(2020, 2027)))
    for year in years
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def valid_existing(path: Path, archive: bool) -> bool:
    if not path.is_file() or path.stat().st_size < 4:
        return False
    signature = path.read_bytes()[:4]
    return signature == (b"PK\x03\x04" if archive else b"%PDF")


def download(source: dict[str, object]) -> Path:
    output = RAW / str(source["file"])
    output.parent.mkdir(parents=True, exist_ok=True)
    if valid_existing(output, bool(source["archive"])):
        return output
    request = urllib.request.Request(str(source["url"]), headers={"User-Agent": "WordTap course importer/1.0"})
    with urllib.request.urlopen(request, timeout=180) as response, output.open("wb") as stream:
        shutil.copyfileobj(response, stream)
    if not valid_existing(output, bool(source["archive"])):
        raise ValueError(f"Downloaded source has an invalid signature: {output}")
    return output


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    records = []
    for source in SOURCES:
        path = download(source)
        if source["archive"]:
            destination = RAW / path.stem
            if destination.exists():
                shutil.rmtree(destination)
            # These legacy archives store Chinese names in GBK without a
            # Unicode path flag. Explicit decoding avoids mojibake directories.
            with zipfile.ZipFile(path, metadata_encoding="gbk") as archive:
                archive.extractall(destination)
        records.append({
            "id": source["id"],
            "url": source["url"],
            "sourcePage": source["sourcePage"],
            "file": path.relative_to(RAW).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        })
    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "sources": records,
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Fetched and verified {len(records)} Kaoyan English sources.")


if __name__ == "__main__":
    main()
