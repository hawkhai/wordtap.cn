#!/usr/bin/env python3
"""Apply already-signed manual PEP decisions to generated JSON without rerunning OCR.

This command never discovers, approves, removes or rewrites content on its own.
Every mutation must have a matching human-authored entry in reviewed-corrections.json.
The full generator remains the end-of-book reproducibility gate.
"""

from __future__ import annotations

import argparse
import copy
import json
import shutil
from pathlib import Path

from pep_english_catalog import BOOK_BY_ID

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "pep-english"
MANIFEST_PATH = OUTPUT / "manifest.json"
DECISIONS_PATH = ROOT / "content" / "pep-english" / "reviewed-corrections.json"


def find_by_pages(lessons: list[dict], page_start: int, page_end: int) -> list[dict]:
    return [lesson for lesson in lessons
            if lesson["source"]["pageStart"] == page_start and lesson["source"]["pageEnd"] == page_end]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--book", required=True, choices=BOOK_BY_ID)
    args = parser.parse_args()
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    decisions = json.loads(DECISIONS_PATH.read_text(encoding="utf-8"))
    group = next((item for item in manifest["groups"] if item["id"] == args.book), None)
    if group is None:
        raise RuntimeError(f"{args.book}: generated group is unavailable")
    details = [json.loads((ROOT / "public" / summary["jsonPath"]).read_text(encoding="utf-8"))
               for summary in group["lessons"]]

    removed = 0
    for decision in (item for item in decisions.get("articleRemovals", []) if item.get("groupId") == args.book):
        matches = find_by_pages(details, decision["pageStart"], decision["pageEnd"])
        if len(matches) > 1:
            raise RuntimeError(f"{decision['baselineId']}: removal matches multiple generated lessons")
        if matches:
            detail = matches[0]
            details.remove(detail)
            target = ROOT / "public" / detail["jsonPath"]
            target.unlink(missing_ok=True)
            removed += 1

    overridden = 0
    for decision in (item for item in decisions.get("articleOverrides", []) if item.get("groupId") == args.book):
        match_page_start = int(decision.get("matchPageStart", decision["pageStart"]))
        match_page_end = int(decision.get("matchPageEnd", decision["pageEnd"]))
        matches = find_by_pages(details, match_page_start, match_page_end)
        if len(matches) != 1:
            raise RuntimeError(f"{decision['baselineId']}: override must match exactly one generated lesson")
        detail = matches[0]
        paragraphs = decision.get("paragraphs", [])
        if not paragraphs or not all(isinstance(item, str) and item.strip() for item in paragraphs):
            raise RuntimeError(f"{decision['baselineId']}: override contains empty paragraphs")
        detail["unitNo"], detail["section"], detail["title"] = int(decision["unitNo"]), decision["section"], decision["title"]
        detail["text"] = "\n".join(paragraphs)
        detail["blocks"] = [{"type": "paragraph", "lang": "en", "text": item} for item in paragraphs]
        detail["source"]["pageStart"] = int(decision["pageStart"])
        detail["source"]["pageEnd"] = int(decision["pageEnd"])
        detail["source"]["manualReview"] = decision.get("review", {})
        (ROOT / "public" / detail["jsonPath"]).write_text(json.dumps(detail, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        overridden += 1

    split_count = 0
    for decision in (item for item in decisions.get("articleSplits", []) if item.get("groupId") == args.book):
        reviewed_parts = decision.get("lessons", [])
        if len(reviewed_parts) < 2:
            raise RuntimeError(f"{decision['baselineId']}: split needs at least two lessons")
        existing_parts = [detail for detail in details
                          if detail.get("source", {}).get("manualReview", {}).get("splitBaselineId") == decision["baselineId"]]
        if existing_parts:
            if len(existing_parts) != len(reviewed_parts):
                raise RuntimeError(f"{decision['baselineId']}: existing split part count does not match decision")
            insertion_index = min(details.index(detail) for detail in existing_parts)
            details = [detail for detail in details if detail not in existing_parts]
            baseline = existing_parts[0]
        else:
            match_page_start = int(decision.get("matchPageStart", decision["pageStart"]))
            match_page_end = int(decision.get("matchPageEnd", decision["pageEnd"]))
            matches = find_by_pages(details, match_page_start, match_page_end)
            if len(matches) != 1:
                raise RuntimeError(f"{decision['baselineId']}: split must match exactly one generated lesson")
            baseline = matches[0]
            insertion_index = details.index(baseline)
            details.remove(baseline)
        replacements = []
        for split_index, reviewed in enumerate(reviewed_parts, start=1):
            paragraphs = reviewed.get("paragraphs", [])
            if not paragraphs or not all(isinstance(item, str) and item.strip() for item in paragraphs):
                raise RuntimeError(f"{decision['baselineId']}: split contains empty paragraphs")
            detail = copy.deepcopy(baseline)
            detail["unitNo"], detail["section"], detail["title"] = int(reviewed["unitNo"]), reviewed["section"], reviewed["title"]
            detail["text"] = "\n".join(paragraphs)
            detail["blocks"] = [{"type": "paragraph", "lang": "en", "text": item} for item in paragraphs]
            detail["source"]["pageStart"] = int(reviewed.get("pageStart", decision["pageStart"]))
            detail["source"]["pageEnd"] = int(reviewed.get("pageEnd", decision["pageEnd"]))
            manual_review = dict(reviewed.get("review", decision.get("review", {})))
            manual_review.update({"splitBaselineId": decision["baselineId"],
                                  "splitIndex": split_index, "splitCount": len(reviewed_parts)})
            detail["source"]["manualReview"] = manual_review
            replacements.append(detail)
        details[insertion_index:insertion_index] = replacements
        split_count += 1

    output_group = ROOT / "public" / "pep-english" / "lessons" / args.book
    shutil.rmtree(output_group, ignore_errors=True)
    output_group.mkdir(parents=True, exist_ok=True)
    for sequence_no, detail in enumerate(details, start=1):
        detail["id"] = f"{args.book}-{sequence_no:03d}"
        detail["sequenceNo"] = sequence_no
        detail["jsonPath"] = f"pep-english/lessons/{args.book}/{sequence_no:03d}.json"
        (ROOT / "public" / detail["jsonPath"]).write_text(json.dumps(detail, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    summary_keys = ("id", "groupId", "unitNo", "sequenceNo", "section", "title", "jsonPath")
    group["lessons"] = [{key: detail[key] for key in summary_keys} for detail in details]
    group["lessonCount"] = len(details)
    manifest["totalLessons"] = sum(item["lessonCount"] for item in manifest["groups"])
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Applied signed decisions for {args.book}: {overridden} override(s), {split_count} split(s), "
          f"{removed} newly removed; {len(details)} lessons remain.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
