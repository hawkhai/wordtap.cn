#!/usr/bin/env python3
"""Generate stable yearly Kaoyan English I/II lessons from verified PDFs."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError as exc:
    raise SystemExit("pypdf is required: python -m pip install pypdf") from exc


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "content" / "kaoyan-english" / "raw"
SOURCE_MANIFEST = ROOT / "content" / "kaoyan-english" / "source-manifest.json"
OUTPUT = ROOT / "public" / "kaoyan-english"
MIN_ALPHA_CHARS = 6_000

E1_RAW_PARENT = "\u82f1\u8bed\u4e00\u771f\u9898\u96c6"
E1_TRANSLATED_PARENT = "\u82f1\u8bed\u4e00\u624b\u8bd1\u7248"
E2_PARENT = "\u82f1\u8bed\u4e8c\u771f\u9898"
PROMOTIONAL_MARKERS = (
    "http://",
    "https://",
    "\u6dd8\u5b9d\u5e97\u94fa",
    "\u5e97\u4e3b\u65fa\u65fa",
    "\u8003\u7814\u6d3e\u4e4b\u5bb6\u516c\u4f17\u53f7",
    "\u56de\u590d\u201c\u8003\u7814\u771f\u9898\u201d",
)


@dataclass
class Paper:
    group_id: str
    year: int
    pages: list[str]
    source_path: Path
    source_id: str
    archive_entry: str


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def clean_page_text(raw: str) -> str:
    value = raw.replace("\u00a0", " ").replace("\r", "\n")
    value = re.sub(r"(?<=\w)-\s*\n\s*(?=[a-z])", "", value)
    lines = []
    for raw_line in value.splitlines():
        line = re.sub(r"[ \t]+", " ", raw_line).strip()
        if not line:
            if lines and lines[-1] != "":
                lines.append("")
            continue
        if any(marker in line for marker in PROMOTIONAL_MARKERS):
            continue
        if re.fullmatch(r"(?:\u82f1\u8bed[（(]?[\u4e00\u4e8c][）)]?\u8bd5\u9898\s*)?[.\-]?\d+[.\-]?", line):
            continue
        lines.append(line)
    return "\n".join(lines).strip()


def page_year(text: str, minimum: int, maximum: int, english_two: bool = False) -> int | None:
    head = text[:800]
    if english_two:
        match = re.search(rf"(?m)^\s*(20(?:1\d|2\d))\s+(?:\u5168\u56fd\u7855\u58eb|\u7814\u7a76\u751f).{{0,80}}\u82f1\u8bed.{{0,8}}[\u4e8c\uff08(]", head)
    else:
        match = re.search(r"(?m)^\s*((?:19|20)\d{2})\s*\u5e74.{0,100}?\u82f1\u8bed", head)
    if not match:
        return None
    year = int(match.group(1))
    return year if minimum <= year <= maximum else None


def split_compilation(path: Path, group_id: str, minimum: int, maximum: int, source_id: str) -> list[Paper]:
    reader = PdfReader(path)
    grouped: dict[int, list[str]] = {}
    current_year: int | None = None
    for page in reader.pages:
        page_text = clean_page_text(page.extract_text() or "")
        detected = page_year(page_text, minimum, maximum, english_two=group_id == "e2")
        if detected is not None:
            current_year = detected
        if current_year is not None and page_text:
            grouped.setdefault(current_year, []).append(page_text)
    return [
        Paper(group_id, year, grouped[year], path, source_id, path.relative_to(RAW).as_posix())
        for year in sorted(grouped)
    ]


def single_paper(path: Path, group_id: str, year: int, source_id: str) -> Paper:
    pages = [clean_page_text(page.extract_text() or "") for page in PdfReader(path).pages]
    return Paper(group_id, year, [page for page in pages if page], path, source_id, path.relative_to(RAW).as_posix())


def select_unique(pattern: str, parent_name: str) -> Path:
    matches = [path for path in RAW.rglob(pattern) if path.parent.name == parent_name]
    if len(matches) != 1:
        raise ValueError(f"Expected one source for {parent_name}/{pattern}, found {len(matches)}")
    return matches[0]


def select_yearly(year: int, parent_name: str) -> Path:
    matches = [
        path for path in RAW.rglob(f"{year}*.pdf")
        if path.parent.name == parent_name and re.match(rf"^{year}(?!-)", path.name)
    ]
    if len(matches) != 1:
        raise ValueError(f"Expected one yearly source for {parent_name}/{year}, found {len(matches)}")
    return matches[0]


def collect_papers() -> list[Paper]:
    papers: list[Paper] = []
    for pattern, minimum, maximum in (
        ("1980-1985*.pdf", 1980, 1985),
        ("1986-1995*.pdf", 1986, 1995),
        ("1996-2004*.pdf", 1996, 2004),
        ("2005-2016*.pdf", 2005, 2016),
    ):
        source = select_unique(pattern, E1_RAW_PARENT)
        papers.extend(split_compilation(source, "e1", minimum, maximum, "swjtuhub-english-1"))
    for year in (2017, 2018, 2019):
        source = select_yearly(year, E1_RAW_PARENT)
        papers.append(single_paper(source, "e1", year, "swjtuhub-english-1"))
    source_2020 = select_unique("2020*.pdf", E1_TRANSLATED_PARENT)
    papers.append(single_paper(source_2020, "e1", 2020, "swjtuhub-english-1"))
    for year in range(2021, 2027):
        source = RAW / "recent" / f"e1-{year}.pdf"
        papers.append(single_paper(source, "e1", year, f"lazynote-e1-{year}"))

    e2_compilation = RAW / "english-2-2010-2016.pdf"
    papers.extend(split_compilation(e2_compilation, "e2", 2010, 2016, "bjcugb-english-2-2010-2016"))
    for year in (2017, 2018, 2019):
        source = select_yearly(year, E2_PARENT)
        papers.append(single_paper(source, "e2", year, "swjtuhub-english-2"))
    for year in range(2020, 2027):
        source = RAW / "recent" / f"e2-{year}.pdf"
        papers.append(single_paper(source, "e2", year, f"lazynote-e2-{year}"))

    by_key: dict[tuple[str, int], Paper] = {}
    for paper in papers:
        key = (paper.group_id, paper.year)
        if key in by_key:
            raise ValueError(f"Duplicate Kaoyan paper: {key}")
        text = "\n\n".join(paper.pages)
        alpha_chars = sum(character.isascii() and character.isalpha() for character in text)
        if alpha_chars < MIN_ALPHA_CHARS:
            raise ValueError(f"Kaoyan paper has too little usable English text: {key}/{alpha_chars}")
        by_key[key] = paper
    return sorted(by_key.values(), key=lambda paper: (paper.group_id, paper.year))


def generate() -> None:
    if not SOURCE_MANIFEST.is_file():
        raise SystemExit("Run tools/fetch-kaoyan-english.py before generating data")
    source_manifest = json.loads(SOURCE_MANIFEST.read_text(encoding="utf-8"))
    source_by_id = {source["id"]: source for source in source_manifest["sources"]}
    papers = collect_papers()
    shutil.rmtree(OUTPUT, ignore_errors=True)
    (OUTPUT / "lessons" / "e1").mkdir(parents=True)
    (OUTPUT / "lessons" / "e2").mkdir(parents=True)
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    groups = []
    for group_id, title, subtitle in (
        ("e1", "考研英语一", "1980-2026 历年真题"),
        ("e2", "考研英语二", "2010-2026 历年真题"),
    ):
        group_papers = [paper for paper in papers if paper.group_id == group_id]
        lessons = []
        for sequence_no, paper in enumerate(group_papers, 1):
            lesson_id = f"{group_id}-{paper.year}"
            title_text = f"{paper.year}年{title}真题"
            json_path = f"kaoyan-english/lessons/{group_id}/{lesson_id}.json"
            text = "\n\n".join(paper.pages)
            summary = {
                "id": lesson_id,
                "sequenceNo": sequence_no,
                "groupId": group_id,
                "year": paper.year,
                "title": title_text,
                "jsonPath": json_path,
                "pageCount": len(paper.pages),
                "characterCount": len(text),
            }
            source_record = source_by_id[paper.source_id]
            detail = {
                "schemaVersion": 1,
                **summary,
                "text": text,
                "blocks": [{"type": "paragraph", "lang": "en", "text": page} for page in paper.pages],
                "source": {
                    "sourceId": paper.source_id,
                    "sourcePage": source_record["sourcePage"],
                    "downloadUrl": source_record["url"],
                    "archiveEntry": paper.archive_entry,
                    "pdfSha256": file_sha256(paper.source_path),
                    "extraction": "pypdf embedded text layer",
                },
            }
            (ROOT / "public" / json_path).write_text(json.dumps(detail, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            lessons.append(summary)
        groups.append({"id": group_id, "title": title, "subtitle": f"{subtitle} · {len(lessons)} 份", "lessonCount": len(lessons), "lessons": lessons})

    manifest = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "generator": "tools/generate-kaoyan-english-data.py",
        "generatorVersion": "1.0.0",
        "courseId": "kaoyan-english",
        "title": "考研英语",
        "totalLessons": len(papers),
        "groups": groups,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(papers)} Kaoyan English papers.")


if __name__ == "__main__":
    generate()
