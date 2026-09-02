#!/usr/bin/env python3
"""Download selected PEP English PDFs without cloning the ChinaTextbook repo."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from pep_english_catalog import BOOKS, BOOK_BY_ID, GITHUB_PREFIX, PepBook


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "content" / "pep-english" / "raw"
SOURCE_MANIFEST = ROOT / "content" / "pep-english" / "source-manifest.json"
USER_AGENT = "WordTap PEP English importer/1.0"


def request(url: str, *, headers: dict[str, str] | None = None) -> urllib.request.Request:
    merged = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    if headers:
        merged.update(headers)
    return urllib.request.Request(url, headers=merged)


def read_url(url: str) -> bytes:
    with urllib.request.urlopen(request(url), timeout=45) as response:
        return response.read()


def url_for_path(prefix: str, path: str) -> str:
    return prefix + "/".join(urllib.parse.quote(part) for part in path.split("/"))


def md5_file(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def valid_pdf(path: Path, expected_size: int | None = None, expected_md5: str | None = None) -> bool:
    if not path.is_file() or path.stat().st_size < 1024:
        return False
    with path.open("rb") as handle:
        if handle.read(5) != b"%PDF-":
            return False
    if expected_size and path.stat().st_size != expected_size:
        return False
    return not expected_md5 or md5_file(path).lower() == expected_md5.lower()


def download(url: str, destination: Path, *, expected_size: int | None = None, expected_md5: str | None = None) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if valid_pdf(destination, expected_size, expected_md5):
        return
    part = destination.with_suffix(destination.suffix + ".part")
    offset = part.stat().st_size if part.exists() else 0
    headers = {"Range": f"bytes={offset}-"} if offset else {}
    try:
        with urllib.request.urlopen(request(url, headers=headers), timeout=90) as response:
            status = getattr(response, "status", 200)
            if offset and status != 206:
                offset = 0
                part.unlink(missing_ok=True)
            mode = "ab" if offset else "wb"
            with part.open(mode) as output:
                shutil.copyfileobj(response, output, length=1024 * 1024)
    except Exception:
        if offset:
            part.unlink(missing_ok=True)
            return download(url, destination, expected_size=expected_size, expected_md5=expected_md5)
        raise
    if not valid_pdf(part, expected_size, expected_md5):
        raise ValueError(f"Downloaded file failed PDF/size/MD5 validation: {url}")
    part.replace(destination)


def download_part(url: str, destination: Path) -> None:
    """Resume a numbered binary part; unlike a complete download it need not have a PDF header."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    offset = temporary.stat().st_size if temporary.is_file() else 0
    headers = {"Range": f"bytes={offset}-"} if offset else {}
    with urllib.request.urlopen(request(url, headers=headers), timeout=90) as response:
        status = getattr(response, "status", 200)
        if offset and status != 206:
            temporary.unlink(missing_ok=True)
            offset = 0
        with temporary.open("ab" if offset else "wb") as output:
            shutil.copyfileobj(response, output, length=1024 * 1024)
    temporary.replace(destination)


def discover_github_parts(book: PepBook) -> list[tuple[str, str]]:
    if not book.github_path:
        return []
    parent, filename = book.github_path.rsplit("/", 1)
    api_url = "https://api.github.com/repos/TapXWorld/ChinaTextbook/contents/" + urllib.parse.quote(parent, safe="/")
    entries = json.loads(read_url(api_url).decode("utf-8"))
    pattern = re.compile(rf"^{re.escape(filename)}\.(\d+)$", re.I)
    parts = []
    for item in entries:
        match = pattern.match(item.get("name", ""))
        download_url = item.get("download_url")
        if match and download_url:
            parts.append((match.group(1), download_url))
    return sorted(parts, key=lambda item: int(item[0]))


def download_github_parts(book: PepBook, destination: Path) -> list[str]:
    parts = discover_github_parts(book)
    if not parts:
        raise FileNotFoundError("No numbered GitHub PDF parts found")
    part_dir = destination.parent / ".parts" / book.id
    downloaded = []
    for number, url in parts:
        part_path = part_dir / number
        download_part(url, part_path)
        downloaded.append(part_path)
    merged = destination.with_suffix(destination.suffix + ".part")
    with merged.open("wb") as output:
        for part_path in downloaded:
            with part_path.open("rb") as source:
                shutil.copyfileobj(source, output, length=1024 * 1024)
    if not valid_pdf(merged):
        raise ValueError("Merged GitHub parts do not form a valid PDF")
    merged.replace(destination)
    shutil.rmtree(part_dir)
    return [url for _, url in parts]


def decode_dzkbw(value: str) -> str:
    shift = 3 + len(value) % 4
    previous = len(value) * 7
    split = len(value) - len(value) // 2
    value = value[split:] + value[:split]
    decoded: list[str] = []
    for char in value:
        result = chr(ord(char) + previous % shift + shift // 2)
        decoded.append(result)
        previous = ord(result)
    return "".join(decoded)


def discover_smartedu(book: PepBook) -> dict:
    base = f"http://www.dzkbw.com/books/rjb/yingyu/{book.dzkbw_slug}/"
    index_html = read_url(base).decode("gb18030", errors="replace")
    chapter_match = re.search(
        rf'href=["\']([^"\']*/{re.escape(book.dzkbw_slug)}/\d{{3}}\.htm)["\']',
        index_html,
        re.I,
    )
    if not chapter_match:
        raise FileNotFoundError(f"No chapter page found at {base}")
    chapter_url = urllib.parse.urljoin(base, html.unescape(chapter_match.group(1)))
    chapter_html = read_url(chapter_url).decode("gb18030", errors="replace")
    go_match = re.search(r'href=["\']([^"\']*/go/[^"\']+)["\']', chapter_html, re.I)
    if not go_match:
        raise FileNotFoundError(f"No SmartEdu redirect found at {chapter_url}")
    go_url = urllib.parse.urljoin(base, html.unescape(go_match.group(1)))
    go_html = read_url(go_url).decode("gb18030", errors="replace")
    encoded_match = re.search(r'url="((?:\\.|[^"])*)";\s*setTimeout', go_html)
    if not encoded_match:
        raise FileNotFoundError(f"Unable to decode SmartEdu redirect at {go_url}")
    encoded_value = encoded_match.group(1).replace('\\"', '"').replace('\\\\', '\\')
    smartedu_url = decode_dzkbw(encoded_value)
    parsed = urllib.parse.urlparse(smartedu_url)
    content_id = urllib.parse.parse_qs(parsed.query).get("contentId", [None])[0]
    if not content_id:
        raise FileNotFoundError(f"SmartEdu URL has no contentId: {smartedu_url}")
    details_url = f"https://s-file-2.ykt.cbern.com.cn/zxx/ndrv2/resources/tch_material/details/{content_id}.json"
    details = json.loads(read_url(details_url).decode("utf-8"))
    source = next((item for item in details.get("ti_items", [])
                   if item.get("ti_is_source_file") and item.get("ti_format") == "pdf"), None)
    if not source or not source.get("ti_storages"):
        raise FileNotFoundError(f"SmartEdu metadata has no source PDF: {content_id}")
    storage = source["ti_storages"][0].replace("-private.ykt.cbern.com.cn", ".ykt.cbern.com.cn")
    return {
        "origin": "smartedu",
        "catalogUrl": base,
        "detailUrl": smartedu_url,
        "contentId": content_id,
        "metadataUrl": details_url,
        "downloadUrl": storage,
        "expectedSize": int(source.get("ti_size") or 0) or None,
        "expectedMd5": source.get("ti_md5") or None,
        "sourceTitle": details.get("title") or details.get("global_title", {}).get("zh-CN"),
    }


def fetch_book(book: PepBook) -> dict:
    target = RAW_DIR / book.filename
    errors: list[str] = []
    if book.github_path:
        github_url = url_for_path(GITHUB_PREFIX, book.github_path)
        try:
            download(github_url, target)
            return {"status": "available", "origin": "ChinaTextbook", "downloadUrl": github_url,
                    "path": target.relative_to(ROOT).as_posix(), "size": target.stat().st_size,
                    "md5": md5_file(target), "errors": errors}
        except Exception as exc:
            errors.append(f"ChinaTextbook: {exc}")
            try:
                part_urls = download_github_parts(book, target)
                return {"status": "available", "origin": "ChinaTextbook-parts", "downloadUrl": part_urls,
                        "path": target.relative_to(ROOT).as_posix(), "size": target.stat().st_size,
                        "md5": md5_file(target), "errors": errors}
            except Exception as part_exc:
                errors.append(f"ChinaTextbook parts: {part_exc}")
    try:
        source = discover_smartedu(book)
        download(source["downloadUrl"], target, expected_size=source["expectedSize"], expected_md5=source["expectedMd5"])
        return {"status": "available", **source, "path": target.relative_to(ROOT).as_posix(),
                "size": target.stat().st_size, "md5": md5_file(target), "errors": errors}
    except Exception as exc:
        errors.append(f"SmartEdu: {exc}")
        return {"status": "missing", "origin": None, "path": None, "errors": errors}


def load_manifest() -> dict:
    if SOURCE_MANIFEST.is_file():
        return json.loads(SOURCE_MANIFEST.read_text(encoding="utf-8"))
    return {"schemaVersion": 1, "expectedBookCount": len(BOOKS), "books": {}}


def main() -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--book", choices=BOOK_BY_ID)
    group.add_argument("--all", action="store_true")
    args = parser.parse_args()
    selected = BOOKS if args.all else (BOOK_BY_ID[args.book],)
    manifest = load_manifest()
    manifest["updatedAt"] = datetime.now(timezone.utc).isoformat()
    for book in selected:
        print(f"Fetching {book.id} ({book.title})...", flush=True)
        manifest["books"][book.id] = {**book.as_dict(), **fetch_book(book)}
        SOURCE_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
        SOURCE_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"  {manifest['books'][book.id]['status']}")
    available = sum(item.get("status") == "available" for item in manifest["books"].values())
    print(f"PEP English sources: {available}/{len(BOOKS)} available")
    return 0


if __name__ == "__main__":
    sys.exit(main())
