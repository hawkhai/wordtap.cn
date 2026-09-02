#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate WordTap NCE JSON assets from NCE-Flow bilingual LRC files."""

from __future__ import annotations

import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

GENERATOR_VERSION = "2.0.0"
EXPECTED_COUNTS = {"nce1": 72, "nce2": 96, "nce3": 60, "nce4": 48}
TITLE_ZH_FALLBACKS = {
    ("nce4", 2): "不要伤害蜘蛛",
}

BOOKS = [
    {
        "id": "nce1",
        "bookNo": 1,
        "sourceKey": "1",
        "sourceDir": "NCE1",
        "title": "新概念英语 第一册",
        "subtitle": "英语初阶 (First Things First)",
    },
    {
        "id": "nce2",
        "bookNo": 2,
        "sourceKey": "2",
        "sourceDir": "NCE2",
        "title": "新概念英语 第二册",
        "subtitle": "实践与进步 (Practice and Progress)",
    },
    {
        "id": "nce3",
        "bookNo": 3,
        "sourceKey": "3",
        "sourceDir": "NCE3",
        "title": "新概念英语 第三册",
        "subtitle": "培养技能 (Developing Skills)",
    },
    {
        "id": "nce4",
        "bookNo": 4,
        "sourceKey": "4",
        "sourceDir": "NCE4",
        "title": "新概念英语 第四册",
        "subtitle": "流利英语 (Fluency in English)",
    },
]

TIME_RE = re.compile(r"^\[(\d+):(\d+(?:\.\d+)?)\](.*)$")
META_RE = re.compile(r"^\[([A-Za-z]+):(.*)\]$")


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def normalize_title(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def to_posix(path: Path) -> str:
    return path.as_posix()


def relative_to_root(path: Path, root: Path) -> str:
    return to_posix(path.resolve().relative_to(root.resolve()))


def parse_timestamp(minutes: str, seconds: str) -> float:
    return int(minutes) * 60 + float(seconds)


def parse_lrc(path: Path) -> tuple[dict[str, str], list[dict[str, Any]]]:
    metadata: dict[str, str] = {}
    rows: list[dict[str, Any]] = []

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line:
            continue

        meta_match = META_RE.match(line)
        if meta_match and not TIME_RE.match(line):
            key, value = meta_match.groups()
            metadata[key] = value.strip()
            continue

        time_match = TIME_RE.match(line)
        if not time_match:
            continue

        minutes, seconds, content = time_match.groups()
        content = content.strip()
        if "|" not in content:
            raise ValueError(f"Missing bilingual separator in {path}: {content}")

        en, zh = content.split("|", 1)
        rows.append(
            {
                "startTime": round(parse_timestamp(minutes, seconds), 3),
                "en": en.strip(),
                "zh": zh.strip(),
            }
        )

    for index, row in enumerate(rows):
        next_row = rows[index + 1] if index + 1 < len(rows) else None
        row["endTime"] = next_row["startTime"] if next_row else None

    return metadata, rows


def lesson_numbers(filename: str) -> list[int]:
    head_match = re.match(r"^[\d&]+", filename)
    if not head_match:
        raise ValueError(f"Unable to parse lesson number from {filename}")
    return [int(value) for value in re.findall(r"\d+", head_match.group(0))]


def source_audio_name(lrc_path: Path) -> str:
    return f"{lrc_path.stem}.mp3"


def locate_title_row(rows: list[dict[str, Any]], title: str) -> int | None:
    expected = normalize_title(title)
    for index, row in enumerate(rows):
        if normalize_title(row["en"]) == expected:
            return index
    return None


def locate_question_row(rows: list[dict[str, Any]], title_row_index: int | None) -> int:
    start_index = 0
    if title_row_index is not None:
        start_index = title_row_index + 1

    for index in range(start_index, len(rows)):
        text = rows[index]["en"]
        if text.startswith("Listen to the tape") or text.startswith("First listen"):
            continue
        if text.endswith("?"):
            return index

    raise ValueError("Unable to locate question row")


def sentence_role(index: int, title_row_index: int | None, question_row_index: int) -> str:
    if index == 0:
        return "lesson"
    if title_row_index is not None and index == title_row_index:
        return "title"
    if index == question_row_index:
        return "question"
    if index < question_row_index:
        return "prompt"
    return "body"


def build_lesson(
    root: Path,
    source_root: Path,
    output_root: Path,
    book: dict[str, Any],
    entry: dict[str, str],
    generated_at: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    filename = entry["filename"]
    title = entry["title"]
    lrc_path = source_root / book["sourceDir"] / f"{filename}.lrc"
    if not lrc_path.exists():
        raise FileNotFoundError(lrc_path)

    metadata, rows = parse_lrc(lrc_path)
    numbers = lesson_numbers(filename)
    lesson_no = numbers[0]
    title_row_index = locate_title_row(rows, title)
    question_row_index = locate_question_row(rows, title_row_index)

    title_zh = ""
    if title_row_index is not None:
        title_zh = rows[title_row_index]["zh"]
    title_zh = title_zh or TITLE_ZH_FALLBACKS.get((book["id"], lesson_no), "")
    if not title_zh:
        raise ValueError(f"Missing Chinese title for {book['id']} lesson {lesson_no}")

    question = rows[question_row_index]["en"]
    question_zh = rows[question_row_index]["zh"]
    body_rows = rows[question_row_index + 1 :]
    body_text = "\n".join(row["en"] for row in body_rows).strip()
    body_text_zh = "\n".join(row["zh"] for row in body_rows).strip()
    text = f"{question}\n\n{body_text}".strip()

    sentences = []
    for index, row in enumerate(rows):
        sentences.append(
            {
                "index": index,
                "startTime": row["startTime"],
                "endTime": row["endTime"],
                "en": row["en"],
                "zh": row["zh"],
                "role": sentence_role(index, title_row_index, question_row_index),
            }
        )

    lesson_id = f"{book['id']}-{lesson_no:03d}"
    json_path = Path("nce") / "lessons" / book["id"] / f"{lesson_no:03d}.json"
    audio_file = source_audio_name(lrc_path)
    audio_path = lrc_path.with_name(audio_file)

    detail = {
        "schemaVersion": 1,
        "id": lesson_id,
        "bookId": book["id"],
        "bookNo": book["bookNo"],
        "lessonNo": lesson_no,
        "lessonRange": numbers,
        "title": title,
        "titleZh": title_zh,
        "question": question,
        "questionZh": question_zh,
        "text": text,
        "bodyText": body_text,
        "bodyTextZh": body_text_zh,
        "sentences": sentences,
        "audio": {
            "fileName": audio_file,
            "sourcePath": relative_to_root(audio_path, root),
            "exists": audio_path.exists(),
        },
        "source": {
            "repository": "NCE-Flow",
            "lrcFileName": f"{filename}.lrc",
            "lrcPath": relative_to_root(lrc_path, root),
            "sourceDataFile": relative_to_root(source_root / "static" / "data.json", root),
            "generatedAt": generated_at,
            "generator": "scripts/generate_nce_json.py",
            "generatorVersion": GENERATOR_VERSION,
            "metadata": metadata,
        },
    }

    summary = {
        "id": lesson_id,
        "bookId": book["id"],
        "bookNo": book["bookNo"],
        "lessonNo": lesson_no,
        "lessonRange": numbers,
        "title": title,
        "titleZh": title_zh,
        "question": question,
        "questionZh": question_zh,
        "jsonPath": to_posix(json_path),
        "sentenceCount": len(sentences),
        "bodySentenceCount": len(body_rows),
        "audio": {
            "fileName": audio_file,
            "sourcePath": relative_to_root(audio_path, root),
            "exists": audio_path.exists(),
        },
        "source": {
            "lrcFileName": f"{filename}.lrc",
            "lrcPath": relative_to_root(lrc_path, root),
        },
    }

    output_path = output_root / "lessons" / book["id"] / f"{lesson_no:03d}.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(detail, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    return summary, detail


def validate_manifest(manifest: dict[str, Any], output_root: Path) -> None:
    total = 0
    for book in manifest["books"]:
        expected = EXPECTED_COUNTS[book["id"]]
        actual = len(book["lessons"])
        if actual != expected:
            raise ValueError(f"{book['id']} expected {expected} lessons, got {actual}")

        seen = set()
        for lesson in book["lessons"]:
            if lesson["lessonNo"] in seen:
                raise ValueError(f"Duplicate lesson number in {book['id']}: {lesson['lessonNo']}")
            seen.add(lesson["lessonNo"])

            detail_path = output_root.parent / lesson["jsonPath"]
            if not detail_path.exists():
                raise FileNotFoundError(detail_path)
            if not lesson["title"] or not lesson["titleZh"] or not lesson["question"]:
                raise ValueError(f"Incomplete summary for {lesson['id']}")

        total += actual

    if total != sum(EXPECTED_COUNTS.values()):
        raise ValueError(f"Expected 276 total lessons, got {total}")


def main() -> None:
    root = repo_root()
    source_root = root / "content" / "NCE-Flow"
    data_file = source_root / "static" / "data.json"
    output_root = root / "public" / "nce"

    if not data_file.exists():
        raise FileNotFoundError(data_file)

    if output_root.exists():
        shutil.rmtree(output_root)
    output_root.mkdir(parents=True)

    source_data = json.loads(data_file.read_text(encoding="utf-8"))
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    manifest_books = []
    total_lessons = 0

    for book in BOOKS:
        print(f"Processing {book['id']}...")
        lessons = []
        source_lessons = source_data[book["sourceKey"]]
        for entry in source_lessons:
            summary, _detail = build_lesson(root, source_root, output_root, book, entry, generated_at)
            lessons.append(summary)

        manifest_books.append(
            {
                "id": book["id"],
                "bookNo": book["bookNo"],
                "title": book["title"],
                "subtitle": book["subtitle"],
                "lessonCount": len(lessons),
                "lessons": lessons,
            }
        )
        total_lessons += len(lessons)
        print(f"  {len(lessons)} lessons")

    manifest = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "generator": "scripts/generate_nce_json.py",
        "generatorVersion": GENERATOR_VERSION,
        "source": {
            "repository": "NCE-Flow",
            "dataFile": relative_to_root(data_file, root),
        },
        "totalLessons": total_lessons,
        "books": manifest_books,
    }

    (output_root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    validate_manifest(manifest, output_root)
    print(f"Generated {total_lessons} lessons under {output_root}")


if __name__ == "__main__":
    main()
