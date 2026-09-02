#!/usr/bin/env python3
"""Convert the postgraduate English LaTeX sources into WordTap lesson JSON."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from graduate_reader import ARTICLES as GRADUATE_ARTICLES
from graduate_reader import VOLUME_ID as GRADUATE_VOLUME_ID
from graduate_reader import parse_graduate_reader


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "content" / "English-for-post-graduate"
DEFAULT_SUPPLEMENTS = ROOT / "content" / "postgraduate"
DEFAULT_GRADUATE_OCR = ROOT / "tools" / "graduate" / "ocr" / "json"
DEFAULT_OUTPUT = ROOT / "public" / "postgraduate"
GENERATOR_VERSION = "1.2.0"
EXPECTED_UNITS = {
    "volume1": {
        1: ("Traits of the Key Players", "Planning Your Future Career"),
        2: ("Culinary Delights in China", "Art of the Table"),
        3: ("Why Harry's Hot", "Leisure Activities"),
        4: ("Love and Loving Relationships", "Love and Marriage"),
        5: ("Yoga in America", "Living a Healthier Life"),
        6: ("Here Is New York", "Sanctuary or Fulfillment"),
        7: ("On Human Nature", "Exploring Human Nature"),
        8: ("The Hidden Danger of Seat Belts", "Smarter Transportation"),
        9: ("The Housing Crisis Goes Suburban", "Affordable Housing"),
        10: ("The Role of the Academy in Times of Crisis", "The Role of Education"),
    },
    "volume2": {unit_no: None for unit_no in range(1, 11)},
}


def replace_balanced_command(text: str, command: str, argument_count: int, keep_argument: int | None) -> str:
    marker = f"\\{command}"
    cursor = 0
    pieces: list[str] = []
    while True:
        start = text.find(marker, cursor)
        if start < 0:
            pieces.append(text[cursor:])
            return "".join(pieces)
        marker_end = start + len(marker)
        if marker_end < len(text) and text[marker_end].isalpha():
            pieces.append(text[cursor:marker_end])
            cursor = marker_end
            continue
        pos = marker_end
        while pos < len(text) and text[pos].isspace():
            pos += 1
        arguments: list[str] = []
        valid = True
        for _ in range(argument_count):
            if pos >= len(text) or text[pos] != "{":
                valid = False
                break
            depth = 0
            arg_start = pos + 1
            pos += 1
            while pos < len(text):
                if text[pos] == "{" and (pos == 0 or text[pos - 1] != "\\"):
                    depth += 1
                elif text[pos] == "}" and (pos == 0 or text[pos - 1] != "\\"):
                    if depth == 0:
                        break
                    depth -= 1
                pos += 1
            if pos >= len(text):
                valid = False
                break
            arguments.append(text[arg_start:pos])
            pos += 1
        if not valid:
            pieces.append(text[cursor:marker_end])
            cursor = marker_end
            continue
        pieces.append(text[cursor:start])
        pieces.append(arguments[keep_argument] if keep_argument is not None else "")
        cursor = pos


def clean_latex(text: str) -> str:
    text = re.sub(r"(?m)^\s*%.*$", "", text)
    text = replace_balanced_command(text, "elegantpar", 2, 0)
    text = replace_balanced_command(text, "footnote", 1, None)
    for command in ("underline", "textit", "textbf", "emph", "bfseries", "normalfont"):
        text = replace_balanced_command(text, command, 1, 0)
    text = replace_balanced_command(text, "textcolor", 2, 1)
    text = replace_balanced_command(text, "hfill", 1, 0)
    text = re.sub(r"\\(?:begin|end)\{(?:center|flushleft|flushright)\}", "\n", text)
    text = re.sub(r"\\setcounter\{[^{}]+\}\{[^{}]+\}", "", text)
    text = re.sub(r"\\(?:qquad|quad|hfill|newpage|clearpage)\b(?:\{\})?", " ", text)
    text = re.sub(r"\\(?:bf|it|rm)\b", "", text)
    text = text.replace("---", "—").replace("--", "—")
    text = text.replace("``", "“").replace("''", "”")
    text = text.replace(r"\&", "&").replace(r"\%", "%").replace(r"\_", "_")
    text = text.replace(r"\ ", " ")
    text = re.sub(r"\\[a-zA-Z@]+\*?(?:\[[^\]]*\])?", "", text)
    text = text.replace("{", "").replace("}", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def paragraph_blocks(raw: str) -> list[dict[str, str]]:
    cleaned = clean_latex(raw)
    blocks: list[dict[str, str]] = []
    for paragraph in re.split(r"\n\s*\n", cleaned):
        text = re.sub(r"\s*\n\s*", " ", paragraph).strip()
        if not text:
            continue
        cjk_count = len(re.findall(r"[\u3400-\u9fff]", text))
        blocks.append({
            "type": "paragraph",
            "lang": "zh" if cjk_count >= max(1, len(text) // 20) else "en",
            "text": text,
        })
    return blocks


def content_blocks(raw: str) -> list[dict[str, str]]:
    chunks = re.split(r"\\newpar\b", raw)
    blocks: list[dict[str, str]] = []
    for chunk in chunks:
        blocks.extend(paragraph_blocks(chunk))
    return blocks


def normalize_title(title: str) -> str:
    title = clean_latex(title)
    fixes = {
        "Oslp": "Oslo",
        "the poetry of architecture": "The Poetry of Architecture",
        "Thinking like a mountain": "Thinking Like a Mountain",
        "How Mass Media affect our perception of reality": "How Mass Media Affect Our Perception of Reality",
    }
    return fixes.get(title.strip(), title.strip())


def lesson_detail(
    *,
    volume_id: str,
    unit_no: int,
    title: str,
    theme: str,
    raw_content: str,
    source_file: str,
) -> dict:
    lesson_id = f"{volume_id}-{unit_no:02d}"
    blocks = content_blocks(raw_content)
    text = "\n".join(block["text"] for block in blocks)
    return {
        "schemaVersion": 1,
        "id": lesson_id,
        "volumeId": volume_id,
        "unitNo": unit_no,
        "title": normalize_title(title),
        "theme": clean_latex(theme),
        "jsonPath": f"postgraduate/lessons/{volume_id}/{unit_no:02d}.json",
        "text": text,
        "blocks": blocks,
        "source": {
            "repository": "English-for-post-graduate",
            "file": source_file,
        },
    }


def parse_first_volume(source_dir: Path) -> list[dict]:
    source_file = "translate.tex"
    text = (source_dir / source_file).read_text(encoding="utf-8")
    pattern = re.compile(r"\\section\*\{Unit\s+(\d+)\\qquad\{\}([^{}]+)\}")
    matches = list(pattern.finditer(text))
    lessons: list[dict] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else text.find(r"\end{document}", match.end())
        raw_content = text[match.end(): end if end >= 0 else len(text)]
        unit_no = int(match.group(1))
        theme = match.group(2).strip()
        title_match = re.search(r"\\textcolor\{tcolor\}\{\\bf\s+([^{}]+)\}", raw_content)
        title = title_match.group(1).strip() if title_match else theme
        lessons.append(lesson_detail(
            volume_id="volume1",
            unit_no=unit_no,
            title=title,
            theme=theme,
            raw_content=raw_content,
            source_file=source_file,
        ))
    return lessons


def parse_second_volume(source_dir: Path) -> list[dict]:
    source_file = "translate2.tex"
    text = (source_dir / source_file).read_text(encoding="utf-8")
    pattern = re.compile(r"\\section\{([^{}]+)\}")
    matches = list(pattern.finditer(text))
    lessons: list[dict] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else text.find(r"\end{document}", match.end())
        title = normalize_title(match.group(1))
        lessons.append(lesson_detail(
            volume_id="volume2",
            unit_no=index + 1,
            title=title,
            theme=title,
            raw_content=text[match.end(): end if end >= 0 else len(text)],
            source_file=source_file,
        ))
    return lessons


def parse_supplements(supplements_dir: Path) -> list[dict]:
    volume_dir = supplements_dir / "volume1"
    if not volume_dir.is_dir():
        return []

    lessons: list[dict] = []
    for source_path in sorted(volume_dir.glob("*.json")):
        payload = json.loads(source_path.read_text(encoding="utf-8"))
        if payload.get("schemaVersion") != 1:
            raise ValueError(f"{source_path}: unsupported schemaVersion")
        unit_no = payload.get("unitNo")
        if unit_no not in EXPECTED_UNITS["volume1"]:
            raise ValueError(f"{source_path}: unitNo must be an integer from 1 to 10")
        expected_title, expected_theme = EXPECTED_UNITS["volume1"][unit_no]
        title = str(payload.get("title", "")).strip()
        theme = str(payload.get("theme", "")).strip()
        if title.casefold() != expected_title.casefold():
            raise ValueError(f"{source_path}: title must be {expected_title!r}")
        if theme.casefold() != expected_theme.casefold():
            raise ValueError(f"{source_path}: theme must be {expected_theme!r}")

        blocks = payload.get("blocks")
        if not isinstance(blocks, list) or not blocks:
            raise ValueError(f"{source_path}: blocks must be a non-empty array")
        normalized_blocks = []
        for index, block in enumerate(blocks):
            if not isinstance(block, dict) or block.get("type") != "paragraph":
                raise ValueError(f"{source_path}: block {index} must be a paragraph")
            lang = block.get("lang")
            text = block.get("text")
            if lang not in {"en", "zh"} or not isinstance(text, str) or not text.strip():
                raise ValueError(f"{source_path}: block {index} needs lang=en|zh and non-empty text")
            normalized_blocks.append({"type": "paragraph", "lang": lang, "text": text.strip()})

        source = payload.get("source")
        if not isinstance(source, dict) or not str(source.get("rightsBasis", "")).strip():
            raise ValueError(f"{source_path}: source.rightsBasis is required")
        lesson_id = f"volume1-{unit_no:02d}"
        relative_source = display_source_path(source_path)
        lessons.append({
            "schemaVersion": 1,
            "id": lesson_id,
            "volumeId": "volume1",
            "unitNo": unit_no,
            "title": expected_title,
            "theme": expected_theme,
            "jsonPath": f"postgraduate/lessons/volume1/{unit_no:02d}.json",
            "text": "\n".join(block["text"] for block in normalized_blocks),
            "blocks": normalized_blocks,
            "source": {
                **source,
                "file": relative_source,
            },
        })
    return lessons


def merge_lessons(primary: list[dict], supplements: list[dict], volume_id: str) -> list[dict]:
    merged = {lesson["unitNo"]: lesson for lesson in primary}
    for lesson in supplements:
        unit_no = lesson["unitNo"]
        if unit_no in merged:
            raise ValueError(f"{volume_id} unit {unit_no}: duplicate primary and supplemental sources")
        merged[unit_no] = lesson
    unexpected = sorted(set(merged) - set(EXPECTED_UNITS[volume_id]))
    if unexpected:
        raise ValueError(f"{volume_id}: unexpected units {unexpected}")
    return [merged[unit_no] for unit_no in sorted(merged)]


def display_source_path(source_path: Path) -> str:
    try:
        return source_path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(source_path)


def summary(detail: dict) -> dict:
    result = {
        "id": detail["id"],
        "volumeId": detail["volumeId"],
        "unitNo": detail["unitNo"],
        "title": detail["title"],
        "theme": detail["theme"],
        "jsonPath": detail["jsonPath"],
        "paragraphCount": len(detail["blocks"]),
    }
    for key in ("articleNo", "textLabel", "author"):
        if key in detail:
            result[key] = detail[key]
    return result


def write_output(source_dir: Path, supplements_dir: Path, graduate_ocr_dir: Path, output_dir: Path) -> None:
    first_volume = merge_lessons(
        parse_first_volume(source_dir),
        parse_supplements(supplements_dir),
        "volume1",
    )
    second_volume = merge_lessons(parse_second_volume(source_dir), [], "volume2")
    graduate_lessons, graduate_corrections = parse_graduate_reader(graduate_ocr_dir)
    volumes_with_lessons = [
        ("volume1", "上册译文", first_volume, 10),
        ("volume2", "下册译文", second_volume, 10),
        (GRADUATE_VOLUME_ID, "读写译教程", graduate_lessons, len(GRADUATE_ARTICLES)),
    ]
    generated_at = datetime.now(timezone.utc).isoformat()
    volumes = []
    missing_lessons = []
    for volume_id, title, lessons, expected_count in volumes_with_lessons:
        if volume_id in EXPECTED_UNITS:
            expected_unit_nos = sorted(EXPECTED_UNITS[volume_id])
            actual_unit_nos = [lesson["unitNo"] for lesson in lessons]
            missing_unit_nos = sorted(set(expected_unit_nos) - set(actual_unit_nos))
            for unit_no in missing_unit_nos:
                expected = EXPECTED_UNITS[volume_id][unit_no]
                missing_lessons.append({
                    "volumeId": volume_id,
                    "unitNo": unit_no,
                    "title": expected[0] if expected else "",
                    "theme": expected[1] if expected else "",
                })
        else:
            missing_unit_nos = []
            expected_ids = {
                f"{GRADUATE_VOLUME_ID}-{article.slug}": article
                for article in GRADUATE_ARTICLES
            }
            actual_ids = {lesson["id"] for lesson in lessons}
            for lesson_id in sorted(set(expected_ids) - actual_ids):
                article = expected_ids[lesson_id]
                missing_lessons.append({
                    "volumeId": volume_id,
                    "unitNo": article.unit_no,
                    "textLabel": f"Text {article.text_label}",
                    "title": article.title,
                    "theme": f"Unit {article.unit_no} · Text {article.text_label}",
                })
        subtitle = (
            f"{len(lessons)}/{expected_count} 篇课文 · 李知宇主编"
            if volume_id == GRADUATE_VOLUME_ID
            else f"{len(lessons)}/{expected_count} 篇双语文章"
        )
        lesson_dir = output_dir / "lessons" / volume_id
        lesson_dir.mkdir(parents=True, exist_ok=True)
        expected_filenames = {Path(detail["jsonPath"]).name for detail in lessons}
        for stale_path in lesson_dir.glob("*.json"):
            if stale_path.name not in expected_filenames:
                stale_path.unlink()
        for detail in lessons:
            detail["source"].update({
                "generatedAt": generated_at,
                "generator": "tools/generate-postgraduate-data.py",
                "generatorVersion": GENERATOR_VERSION,
            })
            (lesson_dir / Path(detail["jsonPath"]).name).write_text(
                json.dumps(detail, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
        volumes.append({
            "id": volume_id,
            "title": title,
            "subtitle": subtitle,
            "lessonCount": len(lessons),
            "expectedLessonCount": expected_count,
            "missingUnitNos": missing_unit_nos,
            "languageMode": "en" if volume_id == GRADUATE_VOLUME_ID else "bilingual",
            "lessons": [summary(detail) for detail in lessons],
        })
    expected_total = sum(volume[3] for volume in volumes_with_lessons)
    total_lessons = sum(volume["lessonCount"] for volume in volumes)
    manifest = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "generator": "tools/generate-postgraduate-data.py",
        "generatorVersion": GENERATOR_VERSION,
        "source": {
            "repository": "NCE/English-for-post-graduate",
            "sourceRoot": display_source_path(source_dir),
            "files": ["translate.tex", "translate2.tex"],
            "supplements": display_source_path(supplements_dir),
            "graduateOcr": display_source_path(graduate_ocr_dir),
        },
        "totalLessons": total_lessons,
        "expectedTotalLessons": expected_total,
        "complete": total_lessons == expected_total and not missing_lessons,
        "missingLessons": missing_lessons,
        "volumes": volumes,
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (output_dir / "graduate-ocr-corrections.json").write_text(
        json.dumps({
            "schemaVersion": 1,
            "generatedAt": generated_at,
            "description": "OneOCR words dropped or corrected while extracting the 20 reading texts.",
            "correctionCount": len(graduate_corrections),
            "corrections": graduate_corrections,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    status = "complete" if manifest["complete"] else f"missing {len(missing_lessons)}"
    print(f"Generated {total_lessons}/{expected_total} postgraduate English lessons ({status}) in {output_dir}.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--supplements", type=Path, default=DEFAULT_SUPPLEMENTS)
    parser.add_argument("--graduate-ocr", type=Path, default=DEFAULT_GRADUATE_OCR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    write_output(
        args.source.resolve(),
        args.supplements.resolve(),
        args.graduate_ocr.resolve(),
        args.output.resolve(),
    )


if __name__ == "__main__":
    main()
