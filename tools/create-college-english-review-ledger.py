#!/usr/bin/env python3
"""Create the 72-row College English manual-review baseline.

This command may refresh machine-computed OCR risk fields, but it preserves all
manual fields and never writes a passing review status.
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
from pathlib import Path
from statistics import fmean

from college_english_catalog import BOOKS, PRINTED_PAGE_OFFSET, ROOT, all_articles


CONTENT = ROOT / "content" / "College-English"
OCR_ROOT = ROOT / "tools" / "College-English"
LEDGER = CONTENT / "manual-review-ledger.tsv"
CATALOG = CONTENT / "article-catalog.json"
COVERAGE = CONTENT / "source-page-audit.tsv"
EVENTS = CONTENT / "manual-review-events.jsonl"
REVIEWED = CONTENT / "reviewed-articles"

LEDGER_FIELDS = [
    "baselineId", "sequenceNo", "groupId", "sourceBook", "bookTitle", "unitNo",
    "unitTitle", "section", "articleType", "title", "printedPageStart",
    "printedPageEnd", "pdfPageStart", "pdfPageEnd", "ocrPageStart", "ocrPageEnd",
    "ocrPageCount", "ocrMinConfidence", "ocrMeanConfidence",
    "ocrLowConfidenceWords", "ocrRotationFlags", "ocrLayoutFlags", "risk",
    "riskReasons", "status", "disposition", "startedAt", "reviewer", "reviewedAt",
    "correctionCount", "evidence", "textSha256", "eventSha256", "notes",
]
MANUAL_FIELDS = {
    "status", "disposition", "startedAt", "reviewer", "reviewedAt",
    "correctionCount", "evidence", "textSha256", "eventSha256", "notes",
}
REVIEWED_BOUNDARY_FIELDS = {
    "printedPageStart", "printedPageEnd", "pdfPageStart", "pdfPageEnd",
    "ocrPageStart", "ocrPageEnd", "ocrPageCount",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def existing_rows() -> dict[str, dict[str, str]]:
    if not LEDGER.is_file():
        return {}
    with LEDGER.open("r", encoding="utf-8-sig", newline="") as handle:
        return {row["baselineId"]: row for row in csv.DictReader(handle, delimiter="\t")}


def page_metrics(source_book: str, pages: range) -> dict[str, object]:
    confidences: list[float] = []
    low_confidence = 0
    rotation_flags = 0
    layout_flags = 0
    reasons: list[str] = []
    missing: list[int] = []
    for page in pages:
        path = OCR_ROOT / source_book / "ocr" / "json" / f"{source_book}_{page}.json"
        if not path.is_file():
            missing.append(page)
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        page_confidences = [
            float(word.get("confidence", 0))
            for line in payload.get("lines", [])
            for word in line.get("words", [])
        ]
        confidences.extend(page_confidences)
        low_confidence += sum(value < 0.90 for value in page_confidences)
        angle = abs(float(payload.get("image_angle", 0))) % 360
        normalized_angle = min(angle, 360 - angle)
        if normalized_angle > 1:
            rotation_flags += 1
        lines = payload.get("lines", [])
        x_centers = []
        for line in lines:
            box = line.get("bounding_box", [])
            if len(box) >= 8:
                x_centers.append((float(box[0]) + float(box[2])) / 2)
        if len(x_centers) >= 12:
            width = float(payload.get("image", {}).get("width", 0))
            left = sum(center < width * 0.45 for center in x_centers)
            right = sum(center > width * 0.55 for center in x_centers)
            if left >= 4 and right >= 4:
                layout_flags += 1
    mean_confidence = fmean(confidences) if confidences else 0.0
    min_confidence = min(confidences) if confidences else 0.0
    if missing:
        risk = "critical"
        reasons.append("missing-ocr-pages:" + ",".join(map(str, missing)))
    elif not confidences:
        risk = "critical"
        reasons.append("empty-ocr-span")
    elif low_confidence >= 10 or mean_confidence < 0.97 or rotation_flags:
        risk = "high"
    else:
        risk = "medium"
    if low_confidence:
        reasons.append(f"words-below-0.90:{low_confidence}")
    if mean_confidence < 0.97:
        reasons.append(f"mean-confidence:{mean_confidence:.6f}")
    if rotation_flags:
        reasons.append(f"rotation-pages:{rotation_flags}")
    if layout_flags:
        reasons.append(f"possible-multicolumn-pages:{layout_flags}")
    if len(pages) > 1:
        reasons.append(f"cross-page-span:{len(pages)}")
    return {
        "ocrMinConfidence": f"{min_confidence:.6f}",
        "ocrMeanConfidence": f"{mean_confidence:.6f}",
        "ocrLowConfidenceWords": str(low_confidence),
        "ocrRotationFlags": str(rotation_flags),
        "ocrLayoutFlags": str(layout_flags),
        "risk": risk,
        "riskReasons": ";".join(reasons),
    }


def catalog_payload() -> dict[str, object]:
    books = []
    articles = all_articles()
    for book in BOOKS:
        pdf_path = CONTENT / f"{book['source_book']}.pdf"
        books.append({
            "id": book["group_id"],
            "sourceBook": book["source_book"],
            "title": book["book_title"],
            "pdfPages": book["pdf_pages"],
            "ocrPages": book["ocr_pages"],
            "pdfSha256": sha256(pdf_path),
            "contentsPages": [15, 16],
            "printedPageOffset": PRINTED_PAGE_OFFSET,
            "plannedArticleCount": 18,
        })
    return {
        "schemaVersion": 1,
        "source": "Map of the book, PDF pages 15-16",
        "articleCount": len(articles),
        "books": books,
        "articles": [
            {
                "id": article.id,
                "sequenceNo": article.sequence_no,
                "groupId": article.group_id,
                "sourceBook": article.source_book,
                "bookTitle": article.book_title,
                "unitNo": article.unit_no,
                "unitTitle": article.unit_title,
                "section": article.section,
                "articleType": article.article_type,
                "title": article.title,
                "printedPageStart": article.printed_page_start,
                "printedPageEnd": article.printed_page_end,
                "pdfPageStart": article.pdf_page_start,
                "pdfPageEnd": article.pdf_page_end,
            }
            for article in articles
        ],
    }


def coverage_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    articles = all_articles()
    for book in BOOKS:
        book_articles = [article for article in articles if article.group_id == book["group_id"]]
        for page in range(1, book["ocr_pages"] + 1):
            printed = page - PRINTED_PAGE_OFFSET
            matches = [article.id for article in book_articles if page in article.ocr_pages]
            if matches:
                classification, reason = "article-candidate", "directory-defined candidate review span"
            elif page <= PRINTED_PAGE_OFFSET:
                classification, reason = "front-matter", "cover/copyright/preface/contents"
            elif printed > max(article.printed_page_end for article in book_articles):
                classification, reason = "vocabulary-or-back-matter", "after final directory-defined article"
            else:
                classification, reason = "teaching-support", "unit opening/exercises/skills/writing/project"
            rows.append({
                "groupId": book["group_id"],
                "sourceBook": book["source_book"],
                "pdfPage": str(page),
                "ocrPage": str(page),
                "printedPage": str(printed) if printed > 0 else "",
                "classification": classification,
                "candidateArticleIds": ",".join(matches),
                "reason": reason,
            })
        for page in range(book["ocr_pages"] + 1, book["pdf_pages"] + 1):
            rows.append({
                "groupId": book["group_id"],
                "sourceBook": book["source_book"],
                "pdfPage": str(page),
                "ocrPage": "",
                "printedPage": "",
                "classification": "trailing-blank",
                "candidateArticleIds": "",
                "reason": "blank trailing PDF page; no OCR image required",
            })
    return rows


def main() -> int:
    CONTENT.mkdir(parents=True, exist_ok=True)
    REVIEWED.mkdir(parents=True, exist_ok=True)
    if not EVENTS.exists():
        EVENTS.write_text("", encoding="utf-8")

    CATALOG.write_text(
        json.dumps(catalog_payload(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    coverage = coverage_rows()
    with COVERAGE.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(coverage[0]), delimiter="\t", lineterminator="\n")
        writer.writeheader()
        writer.writerows(coverage)

    old_rows = existing_rows()
    unknown = set(old_rows) - {article.id for article in all_articles()}
    if unknown:
        raise RuntimeError(f"Ledger contains unknown baseline rows: {sorted(unknown)}")
    rows = []
    for article in all_articles():
        metrics = page_metrics(article.source_book, article.ocr_pages)
        row = {
            "baselineId": article.id,
            "sequenceNo": str(article.sequence_no),
            "groupId": article.group_id,
            "sourceBook": article.source_book,
            "bookTitle": article.book_title,
            "unitNo": str(article.unit_no),
            "unitTitle": article.unit_title,
            "section": article.section,
            "articleType": article.article_type,
            "title": article.title,
            "printedPageStart": str(article.printed_page_start),
            "printedPageEnd": str(article.printed_page_end),
            "pdfPageStart": str(article.pdf_page_start),
            "pdfPageEnd": str(article.pdf_page_end),
            "ocrPageStart": str(article.pdf_page_start),
            "ocrPageEnd": str(article.pdf_page_end),
            "ocrPageCount": str(len(article.ocr_pages)),
            **metrics,
            "status": "pending",
            "disposition": "",
            "startedAt": "",
            "reviewer": "",
            "reviewedAt": "",
            "correctionCount": "0",
            "evidence": "",
            "textSha256": "",
            "eventSha256": "",
            "notes": "",
        }
        if article.id in old_rows:
            for field in MANUAL_FIELDS:
                row[field] = old_rows[article.id].get(field, row[field])
            if old_rows[article.id].get("status") != "pending":
                for field in REVIEWED_BOUNDARY_FIELDS:
                    row[field] = old_rows[article.id].get(field, row[field])
        rows.append(row)

    with LEDGER.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=LEDGER_FIELDS, delimiter="\t", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(
        f"Created {len(rows)} article baselines and {len(coverage)} source-page audit rows; "
        "no article was auto-approved."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
