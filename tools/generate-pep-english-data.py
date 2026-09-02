#!/usr/bin/env python3
"""Convert downloaded PEP English textbooks into audited WordTap lesson JSON."""

from __future__ import annotations

import argparse
import copy
import ctypes
import json
import os
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError as exc:
    raise SystemExit("pypdf is required; run this tool with the bundled workspace Python") from exc

from pep_english_catalog import BOOKS, BOOK_BY_ID

ROOT = Path(__file__).resolve().parents[1]
SOURCE_MANIFEST = ROOT / "content" / "pep-english" / "source-manifest.json"
CORRECTIONS_PATH = ROOT / "content" / "pep-english" / "reviewed-corrections.json"
REPORT_DIR = ROOT / "content" / "pep-english" / "reports"
OUTPUT_DIR = ROOT / "public" / "pep-english"
DEFAULT_ONEOCR_DIR = Path(os.environ["WORDTAP_ONEOCR_DIR"]) if os.environ.get("WORDTAP_ONEOCR_DIR") else None
GENERATOR_VERSION = "1.2.0"

SECTION_PATTERNS = (
    ("Reading and Thinking", re.compile(r"\bReading\s+and\s+Thinking\b", re.I)),
    ("Reading for Writing", re.compile(r"\bReading\s+for\s+Writing\b", re.I)),
    ("Reading and Viewing", re.compile(r"\bReading\s+and\s+Viewing\b", re.I)),
    ("Reading Plus", re.compile(r"\bReading\s+Plus\b", re.I)),
    ("Section B", re.compile(r"\bSection\s+B\b", re.I)),
    ("Section A", re.compile(r"\bSection\s+A\b", re.I)),
    ("Reading", re.compile(r"^\s*Reading\b", re.I | re.M)),
)
EXCLUDED_LINE = re.compile(
    r"^(?:\d+[.)]?\s|[A-D][.)]\s|Listen\b|Match\b|Complete\b|Fill\b|Choose\b|Circle\b|"
    r"Discuss\b|Work\s+in\b|Read\s+the\b|Answer\b|Tick\b|Underline\b|Vocabulary\b|"
    r"Words?\s+and\s+Expressions\b|Grammar\b|Pronunciation\b|Learning\s+objectives?\b)", re.I)
EXCLUDED_CONTENT = re.compile(
    r"Copyright|All rights reserved|ISBN|CIP|Contents|Target Language|Language Goals|"
    r"Learning Objectives?|Tapescripts?|Notes on the Text|Additional Material|Word List|"
    r"Words and Expressions|Page PB", re.I)
INSTRUCTION_WORD = re.compile(
    r"\b(?:read|listen|match|complete|fill|choose|circle|discuss|work in|answer|tick|"
    r"underline|study|look at|write down|practice|check your answers?)\b", re.I)
LEADING_INSTRUCTION = re.compile(
    r"^(?:\W|\d|[a-z]\.)*(?:(?:read|listen|match|complete|fill|choose|circle|discuss|answer|"
    r"tick|underline|study|look|write|use|check|find|put)\b|up\s+the\s+words\b)", re.I)
EARLY_EXERCISE_PHRASE = re.compile(
    r"\b(?:complete the|fill in|match each|answer the questions?|work in pairs?|discuss the|"
    r"use the words?|put the sentences?|look up the words?)\b", re.I)
CONTROL_CHARS = re.compile(r"[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD]")


def normalize_line(value: str) -> str:
    value = CONTROL_CHARS.sub("", value).replace("ﬁ", "fi").replace("ﬂ", "fl")
    value = value.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    for broken, fixed in {
        "W hat": "What", "W here": "Where", "W hen": "When", "W hich": "Which",
        "W ho": "Who", "W hy": "Why", "R ead": "Read", "L ook": "Look", "Th en": "Then",
        "fi ll": "fill", "ar ticle": "article", "par tner": "partner", "w ith": "with",
        "f ind": "find", "diﬀ erent": "different",
    }.items():
        value = value.replace(broken, fixed)
    return re.sub(r"\s+", " ", value).strip()


def join_wrapped_lines(lines: list[str]) -> str:
    result = ""
    for line in map(normalize_line, lines):
        if not line:
            continue
        if result.endswith("-") and re.match(r"^[a-z]", line):
            result = result[:-1] + line
        else:
            result += (" " if result else "") + line
    return re.sub(r"\s+([,.;:!?])", r"\1", result).strip()


def english_score(text: str) -> tuple[int, int, float]:
    letters = len(re.findall(r"[A-Za-z]", text))
    words = len(re.findall(r"\b[A-Za-z][A-Za-z'-]*\b", text))
    visible = len(re.sub(r"\s", "", text))
    return letters, words, letters / max(1, visible)


def apply_corrections(group_id: str, page_no: int, text: str, corrections: list[dict]) -> str:
    for correction in corrections:
        if correction.get("groupId") == group_id and correction.get("page") == page_no:
            find, replace = correction.get("find"), correction.get("replace")
            if isinstance(find, str) and isinstance(replace, str):
                text = text.replace(find, replace)
    return text


class OneOcr:
    def __init__(self, model_dir: Path):
        required = [model_dir / name for name in ("oneocr_wrapper.dll", "oneocr.dll", "oneocr.onemodel", "onnxruntime.dll")]
        missing = [str(path) for path in required if not path.is_file()]
        if missing:
            raise FileNotFoundError("OneOCR runtime is incomplete: " + ", ".join(missing))
        ctypes.WinDLL("kernel32", use_last_error=True).SetDllDirectoryW(str(model_dir))
        self.crt = ctypes.cdll.msvcrt
        self.crt.malloc.argtypes, self.crt.malloc.restype = [ctypes.c_size_t], ctypes.c_void_p
        self.crt.free.argtypes = [ctypes.c_void_p]
        self.alloc_type = ctypes.CFUNCTYPE(ctypes.c_void_p, ctypes.c_size_t)
        self.alloc = self.alloc_type(lambda size: self.crt.malloc(size))
        self.dll = ctypes.CDLL(str(required[0]))
        self.dll.initModel.argtypes, self.dll.initModel.restype = [ctypes.c_wchar_p], ctypes.c_int
        self.dll.releaseModel.restype = ctypes.c_int
        self.dll.ocrImage.argtypes = [ctypes.c_wchar_p, ctypes.POINTER(ctypes.c_char_p), self.alloc_type]
        self.dll.ocrImage.restype = ctypes.c_int
        result = self.dll.initModel(str(model_dir))
        if result != 0:
            raise RuntimeError(f"OneOCR initModel failed with code {result}")

    def close(self) -> None:
        self.dll.releaseModel()

    def image(self, image_path: Path) -> tuple[str, dict]:
        buffer = ctypes.c_char_p(None)
        result = self.dll.ocrImage(str(image_path), ctypes.byref(buffer), self.alloc)
        try:
            if result != 0 or buffer.value is None:
                raise RuntimeError(f"OneOCR ocrImage failed with code {result}")
            payload = json.loads(buffer.value.decode("utf-8"))
        finally:
            if buffer.value is not None:
                self.crt.free(ctypes.cast(buffer, ctypes.c_void_p))
        lines = sorted(payload.get("lines", []), key=lambda line: (
            min(line.get("bounding_box", [0, 0])[1::2] or [0]), min(line.get("bounding_box", [0])[::2] or [0])))
        text = "\n".join(normalize_line(line.get("text", "")) for line in lines if normalize_line(line.get("text", "")))
        confidence = [float(word.get("confidence", 0)) for line in lines for word in line.get("words", [])]
        return text, {
            "meanConfidence": sum(confidence) / len(confidence) if confidence else 0,
            "minimumConfidence": min(confidence) if confidence else 0,
            "wordCount": len(confidence),
        }


def render_page(pdf_path: Path, page_no: int, output_dir: Path) -> Path:
    prefix, image_path = output_dir / f"page-{page_no:04d}", output_dir / f"page-{page_no:04d}.png"
    executable = shutil.which("pdftoppm") or shutil.which("pdftoppm.cmd")
    if executable:
        result = subprocess.run([executable, "-f", str(page_no), "-l", str(page_no), "-r", "200", "-png",
                                 "-singlefile", str(pdf_path), str(prefix)], check=False, capture_output=True)
        if result.returncode == 0 and image_path.is_file():
            return image_path
    try:
        import pypdfium2 as pdfium
    except ImportError as exc:
        raise FileNotFoundError("pdftoppm or pypdfium2 is required to render OneOCR pages") from exc
    document = pdfium.PdfDocument(str(pdf_path))
    try:
        page = document[page_no - 1]
        bitmap = page.render(scale=200 / 72)
        bitmap.to_pil().save(image_path)
        page.close()
    finally:
        document.close()
    return image_path


def detect_unit(text: str, current: int) -> int:
    match = re.search(r"\b(?:STARTER\s+)?UNIT\s+(\d{1,2})\b", text, re.I)
    return int(match.group(1)) if match else current


def detect_section(text: str, current: str) -> str:
    for label, pattern in SECTION_PATTERNS:
        if pattern.search(text):
            return label
    return current


def candidate_paragraphs(text: str) -> list[str]:
    paragraphs, run = [], []

    def flush() -> None:
        if not run:
            return
        paragraph = join_wrapped_lines(run)
        letters, words, ratio = english_score(paragraph)
        if letters >= 220 and words >= 45 and ratio >= 0.64:
            paragraphs.append(paragraph)
        run.clear()

    for line in [normalize_line(line) for line in text.splitlines()]:
        if not line:
            flush()
            continue
        _, words, ratio = english_score(line)
        if EXCLUDED_LINE.search(line) or words < 3 or ratio < 0.55:
            flush()
        else:
            run.append(line)
    flush()
    return paragraphs


def is_complete_passage(text: str) -> bool:
    letters, words, ratio = english_score(text)
    if (letters < 300 or words < 60 or ratio < 0.64 or EXCLUDED_CONTENT.search(text)
            or LEADING_INSTRUCTION.search(text) or EARLY_EXERCISE_PHRASE.search(text[:220])):
        return False
    sentences = len(re.findall(r"[.!?](?:['\"\)]|\s|$)", text))
    speakers = len(re.findall(r"(?:^|\s)[A-Z][A-Za-z ]{0,20}:\s", text))
    if speakers >= 6:
        return words >= 60
    return words >= 75 and sentences >= 5 and len(INSTRUCTION_WORD.findall(text[:240])) <= 1


def probable_title(text: str, fallback: str) -> str:
    for line in [normalize_line(line) for line in text.splitlines()]:
        if not line or line.startswith("*") or EXCLUDED_LINE.search(line) or any(pattern.search(line) for _, pattern in SECTION_PATTERNS):
            continue
        _, words, ratio = english_score(line)
        if 2 <= words <= 14 and ratio >= 0.65 and len(line) <= 100 and not line.endswith((".", "?", "!")):
            if not re.match(r"^(?:UNIT|STARTER UNIT|Page|Learning|Using Language)", line, re.I):
                return line
    return fallback


def extract_book(
    book,
    pdf_path: Path,
    corrections: list[dict],
    enable_ocr: bool,
    oneocr_dir: Path | None,
    source_meta: dict,
) -> tuple[list[dict], dict]:
    reader, raw_lessons, review_pages = PdfReader(str(pdf_path)), [], []
    unit_no, section, ocr_engine = 0, "Reading", None
    with tempfile.TemporaryDirectory(prefix=f"pep-{book.id}-") as temp_name:
        try:
            for page_no, page in enumerate(reader.pages, 1):
                try:
                    embedded = page.extract_text(extraction_mode="layout") or ""
                except TypeError:
                    embedded = page.extract_text() or ""
                embedded = apply_corrections(book.id, page_no, embedded, corrections)
                page_text, mode, metrics = embedded, "text", None
                if enable_ocr and 4 < page_no < len(reader.pages) - 2 and english_score(embedded)[0] < 80:
                    if oneocr_dir is None:
                        raise RuntimeError(
                            "OCR is required for this page; pass --oneocr-dir or set WORDTAP_ONEOCR_DIR"
                        )
                    ocr_engine = ocr_engine or OneOcr(oneocr_dir)
                    ocr_text, metrics = ocr_engine.image(render_page(pdf_path, page_no, Path(temp_name)))
                    if not ocr_text.strip() or metrics["wordCount"] == 0:
                        raise RuntimeError(f"{book.id} page {page_no}: OneOCR returned an empty result")
                    # Divider, illustration and Chinese-only pages are valid non-content pages.
                    if english_score(ocr_text)[0] < 120:
                        if metrics["meanConfidence"] < .90 or metrics["minimumConfidence"] < .65:
                            review_pages.append({"page": page_no, "reason": "non-english-or-divider", **metrics})
                        continue
                    page_text, mode = apply_corrections(book.id, page_no, ocr_text, corrections), "ocr"
                    if metrics["meanConfidence"] < .90 or metrics["minimumConfidence"] < .65:
                        review_pages.append({"page": page_no, "reason": "low-confidence", **metrics})
                unit_no, section = detect_unit(page_text, unit_no), detect_section(page_text, section)
                first_content_page = {"pepj7a": 24, "pepj7b": 12, "pepj8a": 11, "pepj8b": 10, "pepj9": 14}.get(book.id, 8)
                if page_no < first_content_page or re.search(r"^\s*(?:Contents|Tapescripts?|Vocabulary|Word List)", page_text, re.I):
                    continue
                passages = [item for item in candidate_paragraphs(page_text) if is_complete_passage(item)]
                # A page often splits one article into columns or boxed paragraphs.
                # Keep that material as one auditable lesson rather than fragments.
                if passages:
                    passage = "\n".join(passages)
                    raw_lessons.append({
                        "unitNo": unit_no, "section": section,
                        "title": probable_title(page_text, f"Unit {unit_no or 0} · {section}"),
                        "pageStart": page_no, "pageEnd": page_no, "text": passage, "extractionMode": mode,
                    })
        finally:
            if ocr_engine:
                ocr_engine.close()

    merged_lessons = []
    for item in raw_lessons:
        previous = merged_lessons[-1] if merged_lessons else None
        if (previous and item["pageStart"] == previous["pageEnd"] + 1
                and item["unitNo"] == previous["unitNo"] and item["section"] == previous["section"]
                and item["title"].startswith("Unit ")):
            previous["text"] += "\n" + item["text"]
            previous["pageEnd"] = item["pageEnd"]
            if item["extractionMode"] == "ocr":
                previous["extractionMode"] = "ocr"
        else:
            merged_lessons.append(item)

    lessons = []
    for sequence_no, item in enumerate(merged_lessons, 1):
        lesson_id, text = f"{book.id}-{sequence_no:03d}", item["text"]
        lessons.append({
            "schemaVersion": 1, "id": lesson_id, "groupId": book.id, "unitNo": item["unitNo"],
            "sequenceNo": sequence_no, "section": item["section"], "title": item["title"],
            "jsonPath": f"pep-english/lessons/{book.id}/{sequence_no:03d}.json",
            "text": text, "blocks": [{"type": "paragraph", "lang": "en", "text": text}],
            "source": {
                "publisher": "人民教育出版社", "stage": "初中" if book.stage == "junior" else "高中",
                "book": book.title, "pageStart": item["pageStart"], "pageEnd": item["pageEnd"],
                "extractionMode": item["extractionMode"], "origin": source_meta.get("origin"),
                "contentId": source_meta.get("contentId"), "pdfMd5": source_meta.get("md5"),
                "pdfSize": source_meta.get("size"),
            },
        })
    return lessons, {"pageCount": len(reader.pages), "lessonCount": len(lessons), "reviewPages": review_pages}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-ocr", action="store_true")
    parser.add_argument(
        "--oneocr-dir",
        type=Path,
        default=DEFAULT_ONEOCR_DIR,
        help="directory containing the local OneOCR runtime (or set WORDTAP_ONEOCR_DIR)",
    )
    parser.add_argument("--book", choices=BOOK_BY_ID, help="regenerate one book without rewriting other groups")
    args = parser.parse_args()
    source_manifest = json.loads(SOURCE_MANIFEST.read_text(encoding="utf-8")) if SOURCE_MANIFEST.is_file() else {"books": {}}
    correction_payload = json.loads(CORRECTIONS_PATH.read_text(encoding="utf-8"))
    corrections = correction_payload.get("corrections", [])
    article_overrides = correction_payload.get("articleOverrides", [])
    article_removals = correction_payload.get("articleRemovals", [])
    article_splits = correction_payload.get("articleSplits", [])
    selected_books = (BOOK_BY_ID[args.book],) if args.book else BOOKS
    existing_manifest_path = OUTPUT_DIR / "manifest.json"
    existing_manifest = json.loads(existing_manifest_path.read_text(encoding="utf-8")) if args.book and existing_manifest_path.is_file() else None
    if not args.book and OUTPUT_DIR.is_dir():
        shutil.rmtree(OUTPUT_DIR)
    if args.book:
        shutil.rmtree(OUTPUT_DIR / "lessons" / args.book, ignore_errors=True)
    groups = [group for group in (existing_manifest or {}).get("groups", []) if group["id"] != args.book]
    extraction_report_path = REPORT_DIR / "extraction-report.json"
    extraction_report = (json.loads(extraction_report_path.read_text(encoding="utf-8"))
                         if args.book and extraction_report_path.is_file() else {"schemaVersion": 1, "books": {}})
    missing_books = []
    for catalog_book in BOOKS:
        catalog_source = source_manifest.get("books", {}).get(catalog_book.id, {})
        catalog_path = ROOT / catalog_source.get("path", "") if catalog_source.get("path") else None
        if catalog_source.get("status") != "available" or not catalog_path or not catalog_path.is_file():
            missing_books.append({"id": catalog_book.id, "stage": catalog_book.stage,
                                  "title": catalog_book.title, "reason": "source-unavailable"})
    for book in selected_books:
        source = source_manifest.get("books", {}).get(book.id, {})
        source_path = ROOT / source.get("path", "") if source.get("path") else None
        if source.get("status") != "available" or not source_path or not source_path.is_file():
            raise RuntimeError(f"{book.id}: source is unavailable")
        print(f"Extracting {book.id} ({book.title})...", flush=True)
        lessons, report = extract_book(
            book,
            source_path,
            corrections,
            not args.no_ocr,
            args.oneocr_dir,
            source,
        )
        for removal in (item for item in article_removals if item.get("groupId") == book.id):
            matches = [item for item in lessons
                       if item["source"]["pageStart"] == removal.get("pageStart")
                       and item["source"]["pageEnd"] == removal.get("pageEnd")]
            if len(matches) != 1:
                raise RuntimeError(f"{book.id}: reviewed removal expected one lesson: {removal.get('baselineId')}")
            lessons.remove(matches[0])
        for override in (item for item in article_overrides if item.get("groupId") == book.id):
            match_page_start = override.get("matchPageStart", override.get("pageStart"))
            match_page_end = override.get("matchPageEnd", override.get("pageEnd"))
            matches = [item for item in lessons
                       if item["source"]["pageStart"] == match_page_start
                       and item["source"]["pageEnd"] == match_page_end]
            if (not matches and match_page_end > match_page_start
                    and "matchPageStart" not in override and "matchPageEnd" not in override):
                # A reviewed article can deliberately absorb a continuation page whose
                # baseline candidate was removed above. Match the surviving first-page
                # candidate, then expand its audited source range to the reviewed range.
                matches = [item for item in lessons
                           if item["source"]["pageStart"] == match_page_start
                           and item["source"]["pageEnd"] < match_page_end]
            if len(matches) != 1:
                raise RuntimeError(f"{book.id}: reviewed override has no matching lesson: {override.get('baselineId')}")
            lesson = matches[0]
            paragraphs = override.get("paragraphs", [])
            if not paragraphs or not all(isinstance(paragraph, str) and paragraph.strip() for paragraph in paragraphs):
                raise RuntimeError(f"{book.id}: reviewed override has empty paragraphs: {override.get('baselineId')}")
            lesson["unitNo"] = int(override["unitNo"])
            lesson["section"] = override["section"]
            lesson["title"] = override["title"]
            lesson["text"] = "\n".join(paragraphs)
            lesson["blocks"] = [{"type": "paragraph", "lang": "en", "text": paragraph} for paragraph in paragraphs]
            lesson["source"]["pageStart"] = int(override["pageStart"])
            lesson["source"]["pageEnd"] = int(override["pageEnd"])
            lesson["source"]["manualReview"] = override.get("review", {})
        for split in (item for item in article_splits if item.get("groupId") == book.id):
            match_page_start = split.get("matchPageStart", split.get("pageStart"))
            match_page_end = split.get("matchPageEnd", split.get("pageEnd"))
            matches = [(index, item) for index, item in enumerate(lessons)
                       if item["source"]["pageStart"] == match_page_start
                       and item["source"]["pageEnd"] == match_page_end]
            if len(matches) != 1:
                raise RuntimeError(f"{book.id}: reviewed split expected one lesson: {split.get('baselineId')}")
            split_lessons = split.get("lessons", [])
            if len(split_lessons) < 2:
                raise RuntimeError(f"{book.id}: reviewed split needs at least two lessons: {split.get('baselineId')}")
            index, baseline = matches[0]
            replacements = []
            for split_index, reviewed in enumerate(split_lessons, start=1):
                paragraphs = reviewed.get("paragraphs", [])
                if not paragraphs or not all(isinstance(paragraph, str) and paragraph.strip() for paragraph in paragraphs):
                    raise RuntimeError(f"{book.id}: reviewed split has empty paragraphs: {split.get('baselineId')}")
                detail = copy.deepcopy(baseline)
                detail["unitNo"] = int(reviewed["unitNo"])
                detail["section"] = reviewed["section"]
                detail["title"] = reviewed["title"]
                detail["text"] = "\n".join(paragraphs)
                detail["blocks"] = [{"type": "paragraph", "lang": "en", "text": paragraph}
                                    for paragraph in paragraphs]
                detail["source"]["pageStart"] = int(reviewed.get("pageStart", split["pageStart"]))
                detail["source"]["pageEnd"] = int(reviewed.get("pageEnd", split["pageEnd"]))
                manual_review = dict(reviewed.get("review", split.get("review", {})))
                manual_review.update({"splitBaselineId": split["baselineId"],
                                      "splitIndex": split_index, "splitCount": len(split_lessons)})
                detail["source"]["manualReview"] = manual_review
                replacements.append(detail)
            lessons[index:index + 1] = replacements
        if not lessons:
            raise RuntimeError(f"{book.id}: PDF produced no complete English passages")
        for sequence_no, lesson in enumerate(lessons, start=1):
            lesson["id"] = f"{book.id}-{sequence_no:03d}"
            lesson["sequenceNo"] = sequence_no
            lesson["jsonPath"] = f"pep-english/lessons/{book.id}/{sequence_no:03d}.json"
        report["lessonCount"] = len(lessons)
        output_group = OUTPUT_DIR / "lessons" / book.id
        output_group.mkdir(parents=True, exist_ok=True)
        for detail in lessons:
            (ROOT / "public" / detail["jsonPath"]).write_text(json.dumps(detail, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        summaries = [{key: lesson[key] for key in ("id", "groupId", "unitNo", "sequenceNo", "section", "title", "jsonPath")} for lesson in lessons]
        groups.append({
            "id": book.id, "stage": book.stage, "stageTitle": "初中" if book.stage == "junior" else "高中",
            "bookOrder": book.book_order, "title": book.title,
            "subtitle": f"人教版{'初中' if book.stage == 'junior' else '高中'}英语",
            "sourceStatus": "available", "lessonCount": len(summaries), "lessons": summaries,
        })
        extraction_report["books"][book.id] = report
    group_order = {book.id: index for index, book in enumerate(BOOKS)}
    groups.sort(key=lambda group: group_order[group["id"]])
    manifest = {
        "schemaVersion": 1, "generatedAt": datetime.now(timezone.utc).isoformat(),
        "generator": "tools/generate-pep-english-data.py", "generatorVersion": GENERATOR_VERSION,
        "expectedBookCount": len(BOOKS), "availableBookCount": len(groups), "complete": not missing_books,
        "totalLessons": sum(group["lessonCount"] for group in groups), "missingBooks": missing_books, "groups": groups,
    }
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (REPORT_DIR / "extraction-report.json").write_text(json.dumps(extraction_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {manifest['totalLessons']} PEP English lessons from {len(groups)}/{len(BOOKS)} books.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
