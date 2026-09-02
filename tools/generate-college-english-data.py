#!/usr/bin/env python3
"""Publish only the continuous prefix of signed College English articles."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from college_english_catalog import BOOKS, ROOT
from college_english_review import (
    load_catalog,
    load_events,
    load_ledger,
    reviewed_article,
    validate_passed_rows,
)


OUTPUT = ROOT / "public" / "college-english"
LESSONS = OUTPUT / "lessons"


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    catalog = load_catalog()
    _, rows = load_ledger()
    events = load_events()
    passed = validate_passed_rows(rows, events)

    resolved_output = OUTPUT.resolve()
    if resolved_output != (ROOT / "public" / "college-english").resolve():
        raise RuntimeError(f"Refusing to replace unexpected output path: {resolved_output}")
    if LESSONS.exists():
        shutil.rmtree(LESSONS)
    OUTPUT.mkdir(parents=True, exist_ok=True)

    details: list[dict] = []
    for row in passed:
        article_id = row["baselineId"]
        reviewed, text, text_hash = reviewed_article(article_id)
        json_path = f"college-english/lessons/{row['groupId']}/{article_id}.json"
        paragraphs = reviewed["paragraphs"]
        detail = {
            "schemaVersion": 2,
            "id": article_id,
            "sequenceNo": int(row["sequenceNo"]),
            "groupId": row["groupId"],
            "unitNo": int(row["unitNo"]),
            "unitTitle": row["unitTitle"],
            "section": row["section"],
            "articleType": row["articleType"],
            "title": row["title"],
            "printedPageStart": int(row["printedPageStart"]),
            "printedPageEnd": int(row["printedPageEnd"]),
            "jsonPath": json_path,
            "characterCount": len(text),
            "text": text,
            "blocks": [{"type": "paragraph", "lang": "en", "text": paragraph} for paragraph in paragraphs],
            "source": {
                "series": "新视野大学英语（第四版）",
                "book": row["bookTitle"],
                "sourceBook": row["sourceBook"],
                "printedPageStart": int(row["printedPageStart"]),
                "printedPageEnd": int(row["printedPageEnd"]),
                "pdfPageStart": int(row["pdfPageStart"]),
                "pdfPageEnd": int(row["pdfPageEnd"]),
                "pdfSha256": next(book["pdfSha256"] for book in catalog["books"] if book["id"] == row["groupId"]),
                "ocrFiles": [
                    f"tools/College-English/{row['sourceBook']}/ocr/json/{row['sourceBook']}_{page}.json"
                    for page in range(int(row["ocrPageStart"]), int(row["ocrPageEnd"]) + 1)
                ],
            },
            "manualReview": {
                "status": "passed",
                "reviewer": row["reviewer"],
                "reviewedAt": row["reviewedAt"],
                "correctionCount": int(row["correctionCount"]),
                "evidence": row["evidence"],
                "textSha256": text_hash,
                "eventSha256": row["eventSha256"],
            },
        }
        write_json(ROOT / "public" / json_path, detail)
        details.append(detail)

    groups = []
    for book in BOOKS:
        group_details = [detail for detail in details if detail["groupId"] == book["group_id"]]
        summary_keys = (
            "id", "sequenceNo", "groupId", "unitNo", "unitTitle", "section",
            "articleType", "title", "printedPageStart", "printedPageEnd",
            "jsonPath", "characterCount",
        )
        groups.append({
            "id": book["group_id"],
            "title": book["book_title"],
            "subtitle": f"新视野大学英语（第四版）· 已校对 {len(group_details)}/18 篇",
            "sourceBook": book["source_book"],
            "pdfPageCount": book["pdf_pages"],
            "ocrPageCount": book["ocr_pages"],
            "plannedArticleCount": 18,
            "publishedArticleCount": len(group_details),
            "lessonCount": len(group_details),
            "lessons": [{key: detail[key] for key in summary_keys} for detail in group_details],
        })

    generated_at = passed[-1]["reviewedAt"] if passed else "1970-01-01T00:00:00Z"
    manifest = {
        "schemaVersion": 2,
        "generatedAt": generated_at,
        "generator": "tools/generate-college-english-data.py",
        "generatorVersion": "2.0.0",
        "courseId": "college-english",
        "title": "新视野大学英语",
        "plannedArticleCount": 72,
        "publishedArticleCount": len(details),
        "totalLessons": len(details),
        "groups": groups,
    }
    write_json(OUTPUT / "manifest.json", manifest)
    print(f"Published {len(details)}/72 manually reviewed College English articles.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
