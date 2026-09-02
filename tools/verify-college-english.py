#!/usr/bin/env python3
"""Verify the College English catalog, audit trail, and published prefix."""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path

from college_english_catalog import BOOKS, ROOT
from college_english_review import (
    load_catalog,
    load_events,
    load_ledger,
    validate_passed_rows,
)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def contains_absolute_path(value: object) -> bool:
    if isinstance(value, str):
        return bool(re.search(r"(?:\b[A-Za-z]:[\\/]|/Users/|/home/)", value))
    if isinstance(value, dict):
        return any(contains_absolute_path(item) for item in value.values())
    if isinstance(value, list):
        return any(contains_absolute_path(item) for item in value)
    return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--require-complete", action="store_true")
    args = parser.parse_args()

    catalog = load_catalog()
    require(catalog["articleCount"] == 72, "Catalog must contain exactly 72 articles")
    require(len(catalog["books"]) == 4, "Catalog must contain four books")
    articles = catalog["articles"]
    require(len({item["id"] for item in articles}) == 72, "Catalog IDs are not unique")
    require(len({item["title"] for item in articles}) == 72, "Catalog titles are not unique")
    for book in BOOKS:
        book_articles = [item for item in articles if item["groupId"] == book["group_id"]]
        require(len(book_articles) == 18, f"{book['group_id']}: expected 18 articles")
        for unit_no in range(1, 7):
            unit = [item for item in book_articles if item["unitNo"] == unit_no]
            require([item["section"] for item in unit] == ["A", "B", "C"], f"{book['group_id']} unit {unit_no}: expected A/B/C")

    fields, rows = load_ledger()
    require(len(rows) == 72, "Ledger must contain exactly 72 rows")
    require([row["baselineId"] for row in rows] == [item["id"] for item in articles], "Ledger order differs from catalog")
    allowed_statuses = {"pending", "in_review", "needs_fix", "recheck", "passed"}
    require(all(row["status"] in allowed_statuses for row in rows), "Ledger contains an invalid status")
    events = load_events()
    transitions = {
        "pending": {"in_review"},
        "in_review": {"needs_fix", "recheck"},
        "needs_fix": {"recheck"},
        "recheck": {"needs_fix", "passed"},
        "passed": set(),
    }
    catalog_books = {item["id"]: item for item in catalog["books"]}
    row_by_id = {row["baselineId"]: row for row in rows}
    replay_status = {row["baselineId"]: "pending" for row in rows}
    latest_event = {}
    for event in events:
        article_id = event.get("articleId")
        require(article_id in row_by_id, f"Review event references unknown article {article_id}")
        row = row_by_id[article_id]
        current = replay_status[article_id]
        require(event.get("fromStatus") == current, f"{article_id}: event history does not replay from {current}")
        require(event.get("toStatus") in transitions[current], f"{article_id}: invalid event transition")
        require(event.get("sequenceNo") == int(row["sequenceNo"]), f"{article_id}: event sequence mismatch")
        require(isinstance(event.get("reviewer"), str) and event["reviewer"].strip(), f"{article_id}: event reviewer is missing")
        require(event["reviewer"].strip().casefold() not in {"auto", "automatic", "automation", "script"}, f"{article_id}: automated reviewer label is forbidden")
        require(isinstance(event.get("evidence"), str) and event["evidence"].strip(), f"{article_id}: event evidence is missing")
        require(
            event.get("sourcePdfSha256") == catalog_books[row["groupId"]]["pdfSha256"],
            f"{article_id}: event source PDF hash mismatch",
        )
        replay_status[article_id] = event["toStatus"]
        latest_event[article_id] = event
    for row in rows:
        article_id = row["baselineId"]
        require(replay_status[article_id] == row["status"], f"{article_id}: ledger status differs from event history")
        if article_id in latest_event:
            require(row["eventSha256"] == latest_event[article_id]["eventSha256"], f"{article_id}: ledger latest-event hash mismatch")
        else:
            require(row["status"] == "pending" and not row["eventSha256"], f"{article_id}: pending row has unaudited review data")
    passed = validate_passed_rows(rows, events)

    audit_path = ROOT / "content" / "College-English" / "source-page-audit.tsv"
    with audit_path.open("r", encoding="utf-8-sig", newline="") as handle:
        audit = list(csv.DictReader(handle, delimiter="\t"))
    require(len(audit) == 728, "Source-page audit must explain all 728 PDF pages")
    require(sum(bool(row["ocrPage"]) for row in audit) == 725, "Source-page audit must cover all 725 OCR pages")
    trailing = [row for row in audit if row["classification"] == "trailing-blank"]
    require(len(trailing) == 3 and all(not row["ocrPage"] for row in trailing), "Three blank PDF tail pages must explain the PDF/OCR difference")

    manifest_path = ROOT / "public" / "college-english" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    require(manifest["schemaVersion"] == 2, "Public manifest schema must be 2")
    require(manifest["plannedArticleCount"] == 72, "Public planned article count mismatch")
    require(manifest["publishedArticleCount"] == len(passed), "Public published count differs from signed prefix")
    require(manifest["totalLessons"] == len(passed), "Public total lesson count differs from signed prefix")
    summaries = [lesson for group in manifest["groups"] for lesson in group["lessons"]]
    require([item["id"] for item in summaries] == [row["baselineId"] for row in passed], "Published lessons differ from signed prefix")
    require(not any(re.fullmatch(r"rw[1-4]-\d{3}", item["id"]) for item in summaries), "Legacy page lesson remains public")

    referenced_paths: set[Path] = set()
    require(len(summaries) == len(passed), "Published lessons and signed reviews differ in length")
    for summary, row in zip(summaries, passed):
        detail_path = ROOT / "public" / summary["jsonPath"]
        referenced_paths.add(detail_path.resolve())
        detail = json.loads(detail_path.read_text(encoding="utf-8"))
        require(detail["schemaVersion"] == 2, f"{summary['id']}: detail schema mismatch")
        require(detail["id"] == row["baselineId"], f"{summary['id']}: detail ID mismatch")
        require(detail["title"] == row["title"], f"{summary['id']}: title mismatch")
        require(detail["unitNo"] == int(row["unitNo"]) and detail["section"] == row["section"], f"{summary['id']}: unit/section mismatch")
        require(detail["text"] == "\n".join(block["text"] for block in detail["blocks"]), f"{summary['id']}: text/blocks mismatch")
        require(detail["manualReview"]["status"] == "passed", f"{summary['id']}: public review status mismatch")
        require(detail["manualReview"]["eventSha256"] == row["eventSha256"], f"{summary['id']}: event hash mismatch")
        require(not contains_absolute_path(detail), f"{summary['id']}: absolute path leaked")

    lesson_root = ROOT / "public" / "college-english" / "lessons"
    actual_paths = {path.resolve() for path in lesson_root.rglob("*.json")} if lesson_root.is_dir() else set()
    require(actual_paths == referenced_paths, "Public lesson directory contains stale or missing JSON files")
    if args.require_complete:
        require(len(passed) == 72, f"Complete review requires 72 passed articles; found {len(passed)}")
    print(f"Verified 72 baselines, 728 audited PDF pages, and {len(passed)}/72 signed published articles.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
