from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path


LEVELS = (
    ("phonetics", "英语入门讲义-英语国际音标课", "国际音标", "发音基础与国际音标"),
    ("beginner", "英语零基础初级讲义", "初级", "日常对话、语法与词汇"),
    ("intermediate", "英语中级讲义+完整版", "中级", "故事复现、语法与文化"),
    ("upper", "英语中高级讲义（完整版）", "中高级", "精读、理解与写作"),
)
REVIEWED_CORRECTIONS_PATH = Path(__file__).with_name("shuimu-reviewed-corrections.json")
VIDEO_MAP_PATH = Path(__file__).with_name("shuimu-video-map.json")
REVIEWED_CORRECTIONS = {}

CN_DIGITS = {
    "零": 0,
    "〇": 0,
    "一": 1,
    "二": 2,
    "两": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
}

# Mechanical corrections observed while comparing the first generated dataset with
# the reviewed dataset (commit 1c5c159).  Keep this deliberately conservative:
# corrections that need an understanding of the lesson stay in the review pass,
# rather than silently changing otherwise valid source text.
COMMON_TYPO_REPLACEMENTS = {
    "Apossible": "A possible",
    "nationaliy": "nationality",
    "magzines": "magazines",
    "theif": "thief",
    "shalll": "shall",
    "borther": "brother",
    "hadbag": "handbag",
    "dolllars": "dollars",
    "Goerge": "George",
    "onself": "oneself",
    "Austrilia": "Australia",
    "fortun": "fortune",
    "thress": "three",
    "gril": "girl",
    "chage": "charge",
    "meeing": "meeting",
    "moring": "morning",
    "stilll": "still",
    "strictlly": "strictly",
    "wonderfull": "wonderful",
    "ballon": "balloon",
    "untile": "until",
    "meseum": "museum",
    "athelets": "athletes",
    "sandwitch": "sandwich",
    "defamtion": "defamation",
    "beingtold": "being told",
    "unkown": "unknown",
    "investigaing": "investigating",
    "abord": "abroad",
    "quitetly": "quietly",
    "youun": "young",
    "descision": "decision",
    "attact": "attract",
    "fiend of mine": "friend of mine",
    "manufaturers": "manufacturers",
    "listeia": "listeria",
    "discases": "diseases",
    "produets": "products",
    "Northeliffe": "Northcliffe",
    "Dauniless": "Dauntless",
}


def correct_line(value: str) -> str:
    """Apply only repeatable OCR/typing repairs, preserving lesson wording."""
    # PDF extraction occasionally prefixes dialogue with an unpaired question mark.
    value = re.sub(r"^\?(?=(?:——|When |What |That's |It's |Of course|Have |Would |Yes,|No,))", "", value)
    for wrong, correct in COMMON_TYPO_REPLACEMENTS.items():
        value = value.replace(wrong, correct)
    # Spaces before English punctuation are extraction noise.  Do not touch spaces
    # after punctuation: they may be intentional between English and Chinese text.
    value = re.sub(r"\s+([,;:?!])", r"\1", value)
    return value


def chinese_number(value: str) -> int:
    if value.isdigit():
        return int(value)
    if value == "十":
        return 10
    if "十" in value:
        left, right = value.split("十", 1)
        tens = CN_DIGITS.get(left, 1) if left else 1
        ones = CN_DIGITS.get(right, 0) if right else 0
        return tens * 10 + ones
    return CN_DIGITS[value]


def clean_line(value: str) -> str:
    # PDF bullet glyphs can be extracted as font-specific private-use code
    # points. Convert every reviewed variant to a portable Unicode marker.
    value = (
        value.replace("\uf02e", "•")
        .replace("\uf06c", "•")
        .replace("\uf0a1", "◦")
        .replace("\uf06e", "▪")
        .replace("\uf0a8", "▫")
        .replace("\uf075", "▶")
        .replace("\uf0d8", "➢")
        .replace("\uf0b2", "◆")
    )
    value = value.replace("… …", "……").replace("．", ".")
    return correct_line(re.sub(r"\s+", " ", value).strip())


def read_lines(path: Path) -> list[str]:
    return [clean_line(line) for line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines()]


def content_lines(lines: list[str]) -> list[str]:
    result: list[str] = []
    for line in lines:
        if not line or line == "水木英语" or re.fullmatch(r"\d{1,3}", line):
            continue
        if result and result[-1] == line:
            continue
        result.append(line)
    return result


def block_type(line: str) -> str:
    if "【" in line and "】" in line:
        return "heading"
    if re.match(r"^(?:第[一二三四五六七八九十百零〇两\d]+(?:单元|课)|入门课)\b", line):
        return "heading"
    if re.match(r"^(?:Step\s*\d+|Passage|Vocabulary|Notes|Question|Introduce the story)\s*[:：]", line, re.I):
        return "subheading"
    if line.startswith(("•", "◦", "▪", "▫", "▶", "➢", "◆")):
        return "list"
    return "paragraph"


def apply_reviewed_corrections(lesson_id: str, lines: list[str]) -> list[str]:
    """Apply the reviewed, lesson-scoped edits captured from commit 1c5c159.

    Corrections are scoped to a lesson and expressed as source/target line runs,
    so a genuine source update fails loudly instead of being silently rewritten.
    """
    corrections = REVIEWED_CORRECTIONS.get(lesson_id, [])
    result = list(lines)
    for correction in corrections:
        before = correction["before"]
        after = correction["after"]
        width = len(before)
        matches = [index for index in range(len(result) - width + 1) if result[index:index + width] == before]
        if len(matches) != 1:
            raise RuntimeError(
                f"{lesson_id}: reviewed correction expected one source match, found {len(matches)}: {before!r}"
            )
        start = matches[0]
        result[start:start + width] = after
    return result


def make_detail(level_id: str, unit_no: int, title: str, lines: list[str], source_file: str, videos: list[dict] | None = None) -> dict:
    cleaned = content_lines(lines)
    lesson_id = f"{level_id}-{unit_no:03d}"
    cleaned = apply_reviewed_corrections(lesson_id, cleaned)
    blocks = [{"type": block_type(line), "text": line} for line in cleaned]
    return {
        "schemaVersion": 1,
        "id": lesson_id,
        "levelId": level_id,
        "unitNo": unit_no,
        "title": title,
        "jsonPath": f"shuimu/lessons/{level_id}/{unit_no:03d}.json",
        "text": "\n".join(cleaned),
        "blocks": blocks,
        "videos": videos or [],
        "source": {"fileName": source_file, "kind": "PDF 校对后的转换文本"},
    }


def split_phonetics(lines: list[str], source_file: str) -> list[dict]:
    marker = re.compile(r"^(?:入门课|第[一二三四五六七八九十百零〇两\d]+课)\s*[：:]")
    starts = [i for i, line in enumerate(lines) if marker.match(line)]
    details = []
    for number, start in enumerate(starts, 1):
        end = starts[number] if number < len(starts) else len(lines)
        title = re.sub(r"\s+", " ", lines[start])
        details.append(make_detail("phonetics", number, title, lines[start:end], source_file))
    return details


def split_beginner(lines: list[str], source_file: str) -> list[dict]:
    marker = re.compile(r"^第([一二三四五六七八九十百零〇两\d]+)单元$")
    starts = []
    for index, line in enumerate(lines):
        match = marker.match(line)
        if match:
            starts.append((index, chinese_number(match.group(1))))
    details = []
    for index, (start, unit_no) in enumerate(starts):
        end = starts[index + 1][0] if index + 1 < len(starts) else len(lines)
        chunk = lines[start:end]
        headings = [line for line in chunk if "【" in line and "】" in line]
        title = headings[0] if headings else f"第{unit_no}单元"
        details.append(make_detail("beginner", unit_no, title, chunk, source_file))
    return details


def intermediate_story_title(line: str) -> tuple[str, str] | None:
    if "【故事复现】" not in line:
        return None
    title = line.split("【故事复现】", 1)[1].strip()
    root = re.sub(r"[（(]\s*[上下]\s*[）)]", "", title)
    root = re.sub(r"\s+", "", root)
    return root, title


def parse_bilibili(path: Path) -> dict[int, list[dict]]:
    if not path.is_file():
        raise FileNotFoundError(
            f"Missing Bilibili course export: {path}. "
            "Pass --bilibili with the exported HTML/text file used to map the 50 videos."
        )
    raw = path.read_text(encoding="utf-8-sig", errors="replace")
    records: dict[int, list[dict]] = {}
    for article in re.findall(r"<article\b.*?</article>", raw, re.S):
        number_match = re.search(r"<span[^>]*>(\d+)</span>", article)
        title_match = re.search(r'class="season-title(?:-active)?"[^>]*>(.*?)</p>', article, re.S)
        duration_match = re.search(r">(\d+分\d+秒)</p>", article)
        if not number_match or not title_match:
            continue
        position = int(number_match.group(1))
        title = clean_line(html.unescape(re.sub(r"<.*?>", "", title_match.group(1))))
        course_match = re.search(r"中级\s*(\d+)\.(\d+)", title)
        if not course_match:
            continue
        unit_no, lesson_no = map(int, course_match.groups())
        ep_no = 53067 + position - 246
        records.setdefault(unit_no, []).append({
            "lessonNo": lesson_no,
            "position": position,
            "title": title,
            "duration": duration_match.group(1) if duration_match else "",
            "url": f"https://www.bilibili.com/cheese/play/ep{ep_no}",
            "mappingBasis": "第 246 节对应 ep53067，按相邻课程顺序推算",
        })
    for videos in records.values():
        videos.sort(key=lambda item: item["lessonNo"])
    return records


def load_video_map(path: Path) -> dict[int, list[dict]]:
    """Load the reviewed mapping when the original Bilibili page export is absent."""
    if not path.is_file():
        raise FileNotFoundError(
            f"Missing Bilibili course export: {path}; also missing reviewed fallback {VIDEO_MAP_PATH}."
        )
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {int(unit_no): videos for unit_no, videos in payload.items()}


def split_intermediate(lines: list[str], source_file: str, video_map: dict[int, list[dict]]) -> list[dict]:
    starts: list[tuple[int, str, str]] = []
    last_root = ""
    for index, line in enumerate(lines):
        parsed = intermediate_story_title(line)
        if not parsed:
            continue
        root, title = parsed
        if root != last_root:
            starts.append((index, root, title))
            last_root = root
    details = []
    for index, (start, _root, title) in enumerate(starts):
        unit_no = index + 1
        end = starts[index + 1][0] if index + 1 < len(starts) else len(lines)
        title = re.sub(r"[（(]\s*上\s*[）)]", "", title).strip()
        details.append(make_detail("intermediate", unit_no, title, lines[start:end], source_file, video_map.get(unit_no)))
    return details


def split_upper(lines: list[str], source_file: str) -> list[dict]:
    passage_indexes = [i for i, line in enumerate(lines) if re.fullmatch(r"Passage\s*[:：]", line, re.I)]
    starts: list[int] = []
    for passage in passage_indexes:
        window = range(max(0, passage - 45), passage)
        introductions = [i for i in window if re.match(r"^Introduce the story\s*[:：]", lines[i], re.I)]
        steps = [i for i in window if re.match(r"^Step\s*1\s*[:：]", lines[i], re.I)]
        starts.append(introductions[-1] if introductions else (steps[-1] if steps else max(0, passage - 20)))
    details = []
    for index, start in enumerate(starts):
        unit_no = index + 1
        end = starts[index + 1] if index + 1 < len(starts) else len(lines)
        chunk = lines[start:end]
        reading = next((line for line in chunk if "【阅读理解】" in line), "")
        title = reading.split("【阅读理解】", 1)[1].strip() if reading else f"第{unit_no}单元"
        chunk = [re.sub(r"^\d+\.(1|2|3)(?=【)", rf"{unit_no}.\1", line) for line in chunk]
        details.append(make_detail("upper", unit_no, title, chunk, source_file))
    return details


def source_metadata(root: Path, stem: str) -> dict:
    files = []
    for suffix in (".pdf", ".docx", ".txt"):
        path = root / f"{stem}{suffix}"
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        files.append({"fileName": path.name, "bytes": path.stat().st_size, "sha256": digest})
    return {"files": files}


def write_output(output: Path, levels: list[dict], details_by_level: dict[str, list[dict]], source_root: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    total = sum(len(items) for items in details_by_level.values())
    newest = max((source_root / f"{stem}.txt").stat().st_mtime for _, stem, _, _ in LEVELS)
    generated_at = datetime.fromtimestamp(newest, tz=timezone.utc).isoformat()
    manifest = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "generator": "tools/generate-shuimu-data.py",
        "generatorVersion": "1.1.0",
        "totalLessons": total,
        "levels": levels,
        "source": {
            "directoryName": source_root.name,
            "bilibiliFile": "bilibili.txt",
            "note": "PDF 为原版校验基准；TXT 为正文切分源；DOCX 用于结构抽查。",
        },
    }
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for level_id, details in details_by_level.items():
        lesson_dir = output / "lessons" / level_id
        lesson_dir.mkdir(parents=True, exist_ok=True)
        for detail in details:
            (lesson_dir / f'{detail["unitNo"]:03d}.json').write_text(
                json.dumps(detail, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Water & Wood English study data.")
    parser.add_argument("--source", type=Path, required=True, help="directory containing the local source TXT files")
    parser.add_argument("--output", type=Path, default=Path("public/shuimu"))
    parser.add_argument(
        "--bilibili",
        type=Path,
        help="Bilibili course-page export used for intermediate video mapping (default: SOURCE/bilibili.txt).",
    )
    parser.add_argument(
        "--skip-videos",
        action="store_true",
        help="Generate text-only data for review when the Bilibili export is unavailable.",
    )
    args = parser.parse_args()

    global REVIEWED_CORRECTIONS
    REVIEWED_CORRECTIONS = json.loads(REVIEWED_CORRECTIONS_PATH.read_text(encoding="utf-8"))
    bilibili_path = args.bilibili or args.source / "bilibili.txt"
    if args.skip_videos:
        video_map = {}
    elif bilibili_path.is_file():
        video_map = parse_bilibili(bilibili_path)
    else:
        video_map = load_video_map(VIDEO_MAP_PATH)
    details_by_level: dict[str, list[dict]] = {}
    levels = []
    expected = {"phonetics": 12, "beginner": 50, "intermediate": 70, "upper": 60}
    splitters = {
        "phonetics": lambda lines, source: split_phonetics(lines, source),
        "beginner": lambda lines, source: split_beginner(lines, source),
        "intermediate": lambda lines, source: split_intermediate(lines, source, video_map),
        "upper": lambda lines, source: split_upper(lines, source),
    }

    for level_id, stem, title, subtitle in LEVELS:
        txt_name = f"{stem}.txt"
        details = splitters[level_id](read_lines(args.source / txt_name), txt_name)
        if len(details) != expected[level_id]:
            raise RuntimeError(f"{level_id}: expected {expected[level_id]} units, got {len(details)}")
        details_by_level[level_id] = details
        lessons = []
        for detail in details:
            lesson = {key: detail[key] for key in ("id", "levelId", "unitNo", "title", "jsonPath")}
            lesson["videoCount"] = len(detail["videos"])
            lessons.append(lesson)
        levels.append({
            "id": level_id,
            "title": title,
            "subtitle": subtitle,
            "lessonCount": len(details),
            "lessons": lessons,
            "source": source_metadata(args.source, stem),
        })

    mapped_videos = sum(len(videos) for videos in video_map.values())
    if not args.skip_videos and mapped_videos != 50:
        raise RuntimeError(f"Expected 50 Bilibili mappings, got {mapped_videos}")
    write_output(args.output, levels, details_by_level, args.source)
    print(f"Generated {sum(map(len, details_by_level.values()))} lessons and {mapped_videos} Bilibili links in {args.output}.")


if __name__ == "__main__":
    main()
