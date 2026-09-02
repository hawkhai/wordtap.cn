#!/usr/bin/env python3
"""Build the CET-4/CET-6 course from locally supplied exam PDFs.

Only question papers with a usable embedded text layer are published. Scanned
papers, answer sheets, explanations and writing-template files remain in the
source audit and are never emitted as lessons.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError as exc:  # pragma: no cover - environment guidance
    raise SystemExit("pypdf is required: python -m pip install pypdf") from exc


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path(r"D:\新建文件夹\英语四六级")
OUTPUT = ROOT / "public" / "cet"
AUDIT_OUTPUT = ROOT / "content" / "cet" / "source-audit.json"
MIN_ALPHA_CHARS = 6_000

EXCLUDED_NAME_PARTS = ("解析", "答案", "作文", "模板", "听力")
SET_PATTERNS = (
    (1, ("第1套", "第一套", "卷一", "卷1", "（第一套）", "(第一套)")),
    (2, ("第2套", "第二套", "卷二", "卷2", "（第二套）", "(第二套)")),
    (3, ("第3套", "第三套", "卷三", "卷3", "（第三套）", "(第三套)")),
)


@dataclass
class Candidate:
    path: Path
    relative_path: str
    level: str
    year: int
    month: int
    set_no: int
    page_count: int
    alpha_chars: int
    text: str
    sha256: str
    root_aligned: bool


def parse_level(value: str) -> str | None:
    upper = value.upper()
    if "CET4" in upper or "四级" in value or "4级" in value:
        return "cet4"
    if "CET6" in upper or "六级" in value or "6级" in value:
        return "cet6"
    return None


def parse_date(value: str) -> tuple[int, int] | None:
    matches = re.findall(r"(20(?:1[5-9]|2[0-9]))\s*(?:年|[.\-_])\s*(0?[3679]|0?12)\s*月?", value)
    if not matches:
        return None
    year, month = matches[-1]
    return int(year), int(month)


def parse_set_no(name: str) -> int:
    for set_no, markers in SET_PATTERNS:
        if any(marker in name for marker in markers):
            return set_no
    number_match = re.search(r"第\s*([123])\s*套", name)
    if number_match:
        return int(number_match.group(1))
    stable_name_match = re.search(r"cet[46]_20\d{2}_(?:0[3679]|12)_([123])\.pdf$", name, re.IGNORECASE)
    return int(stable_name_match.group(1)) if stable_name_match else 0


def clean_page_text(raw: str) -> str:
    value = raw.replace("\u00a0", " ").replace("\r", "\n")
    value = re.sub(r"(?<=\w)-\s*\n\s*(?=[a-z])", "", value)
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.splitlines()]
    kept: list[str] = []
    for line in lines:
        if not line:
            if kept and kept[-1] != "":
                kept.append("")
            continue
        if re.fullmatch(r"(?:大学英语[四六]级考试)?\s*\d+", line):
            continue
        kept.append(line)
    return "\n".join(kept).strip()


def read_candidate(path: Path, source: Path) -> Candidate | None:
    relative = path.relative_to(source)
    source_label = str(relative)
    level = parse_level(source_label)
    date = parse_date(source_label)
    stable_source_name = bool(re.search(r"cet[46]_20\d{2}_(?:0[3679]|12)_[123]\.pdf$", path.name, re.IGNORECASE))
    if level is None or date is None or ("真题" not in source_label and not stable_source_name):
        return None
    if any(marker in path.name for marker in EXCLUDED_NAME_PARTS):
        return None

    reader = PdfReader(path)
    pages = [clean_page_text(page.extract_text() or "") for page in reader.pages]
    text = "\n\n".join(page for page in pages if page)
    alpha_chars = sum(character.isascii() and character.isalpha() for character in text)
    if alpha_chars < MIN_ALPHA_CHARS:
        return None

    year, month = date
    dated_folders = [part for part in relative.parts[:-1] if parse_date(part)]
    first_folder_date = parse_date(dated_folders[0]) if dated_folders else None
    return Candidate(
        path=path,
        relative_path=relative.as_posix(),
        level=level,
        year=year,
        month=month,
        set_no=parse_set_no(path.name),
        page_count=len(reader.pages),
        alpha_chars=alpha_chars,
        text=text,
        sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        root_aligned=first_folder_date == date,
    )


def choose_candidates(candidates: list[Candidate]) -> list[Candidate]:
    # Remove byte-identical copies first, preferring the correctly dated folder.
    by_hash: dict[str, Candidate] = {}
    for candidate in candidates:
        previous = by_hash.get(candidate.sha256)
        score = (candidate.root_aligned, -len(candidate.relative_path))
        previous_score = (previous.root_aligned, -len(previous.relative_path)) if previous else None
        if previous is None or score > previous_score:
            by_hash[candidate.sha256] = candidate

    unique = list(by_hash.values())
    by_key: dict[tuple[str, int, int, int], Candidate] = {}
    for candidate in unique:
        key = (candidate.level, candidate.year, candidate.month, candidate.set_no)
        previous = by_key.get(key)
        score = (candidate.root_aligned, candidate.alpha_chars, -len(candidate.relative_path))
        previous_score = (previous.root_aligned, previous.alpha_chars, -len(previous.relative_path)) if previous else None
        if previous is None or score > previous_score:
            by_key[key] = candidate

    selected = list(by_key.values())
    # An aggregate "all three sets" PDF is useful only when the source has no
    # separately addressable paper for that level/session.
    sessions_with_individuals = {
        (item.level, item.year, item.month) for item in selected if item.set_no > 0
    }
    selected = [
        item for item in selected
        if item.set_no > 0 or (item.level, item.year, item.month) not in sessions_with_individuals
    ]
    selected.sort(key=lambda item: (item.level, item.year, item.month, item.set_no))
    return selected


def blocks_for(text: str) -> list[dict[str, str]]:
    blocks = []
    for page in text.split("\n\n"):
        page = page.strip()
        if page:
            blocks.append({"type": "paragraph", "lang": "en", "text": page})
    return blocks


def generate(source: Path) -> None:
    if not source.is_dir():
        raise SystemExit(f"CET source directory does not exist: {source}")

    pdf_files = sorted(source.rglob("*.pdf"))
    candidates: list[Candidate] = []
    errors: list[dict[str, str]] = []
    for path in pdf_files:
        try:
            candidate = read_candidate(path, source)
            if candidate:
                candidates.append(candidate)
        except Exception as exc:  # keep one damaged PDF from stopping the import
            errors.append({"path": path.relative_to(source).as_posix(), "error": str(exc)})

    selected = choose_candidates(candidates)
    if not selected:
        raise SystemExit("No CET question papers with a usable embedded text layer were found")

    shutil.rmtree(OUTPUT, ignore_errors=True)
    (OUTPUT / "lessons" / "cet4").mkdir(parents=True)
    (OUTPUT / "lessons" / "cet6").mkdir(parents=True)
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    groups = []
    for level, group_title in (("cet4", "英语四级"), ("cet6", "英语六级")):
        items = [item for item in selected if item.level == level]
        lessons = []
        for sequence_no, item in enumerate(items, 1):
            # The ID is semantic rather than positional. Adding an older paper
            # later must never renumber or invalidate existing shared links.
            lesson_id = f"{level}-{item.year:04d}{item.month:02d}{item.set_no:02d}"
            session = f"{item.year}年{item.month}月"
            set_label = f"第{item.set_no}套" if item.set_no else "全套合卷"
            title = f"{session}{group_title}真题{set_label}"
            json_path = f"cet/lessons/{level}/{lesson_id}.json"
            summary = {
                "id": lesson_id,
                "sequenceNo": sequence_no,
                "groupId": level,
                "year": item.year,
                "month": item.month,
                "setNo": item.set_no,
                "title": title,
                "jsonPath": json_path,
                "pageCount": item.page_count,
                "characterCount": len(item.text),
            }
            detail = {
                "schemaVersion": 1,
                **summary,
                "text": item.text,
                "blocks": blocks_for(item.text),
                "source": {
                    "relativePath": item.relative_path,
                    "pdfSha256": item.sha256,
                    "extraction": "pypdf embedded text layer",
                },
            }
            output_path = ROOT / "public" / json_path
            output_path.write_text(json.dumps(detail, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            lessons.append(summary)
        year_range = str(items[0].year) if items[0].year == items[-1].year else f"{items[0].year}-{items[-1].year}"
        groups.append({
            "id": level,
            "title": group_title,
            "subtitle": f"{year_range} 真题 · {len(lessons)} 份可检索试卷",
            "lessonCount": len(lessons),
            "lessons": lessons,
        })

    manifest = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "generator": "tools/generate-cet-data.py",
        "generatorVersion": "1.0.0",
        "courseId": "cet",
        "title": "英语四六级真题",
        "totalLessons": len(selected),
        "groups": groups,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    AUDIT_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    extension_counts: dict[str, int] = {}
    all_files = [path for path in source.rglob("*") if path.is_file()]
    for path in all_files:
        extension_counts[path.suffix.lower() or "(none)"] = extension_counts.get(path.suffix.lower() or "(none)", 0) + 1
    audit = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "sourceRoot": source.name,
        "totalFiles": len(all_files),
        "totalBytes": sum(path.stat().st_size for path in all_files),
        "extensionCounts": dict(sorted(extension_counts.items())),
        "pdfCount": len(pdf_files),
        "textLayerCandidates": len(candidates),
        "publishedLessons": len(selected),
        "policy": "Question papers only; embedded text layer required; answers, explanations, audio and writing templates are excluded.",
        "publishedSources": [item.relative_path for item in selected],
        "pdfReadErrors": errors,
    }
    AUDIT_OUTPUT.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(selected)} CET lessons from {len(pdf_files)} PDFs.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()
    generate(args.source.resolve())


if __name__ == "__main__":
    main()
