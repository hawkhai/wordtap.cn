#!/usr/bin/env python3
"""Create the immutable baseline ledger for manual PEP English article review.

This tool only creates missing rows. It never changes a human review status and
therefore cannot be used to auto-approve lessons.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "public" / "pep-english" / "manifest.json"
REPORT = ROOT / "content" / "pep-english" / "reports" / "extraction-report.json"
LEDGER = ROOT / "content" / "pep-english" / "manual-review-ledger.tsv"

FIELDS = [
    "baselineId", "groupId", "unitNo", "sequenceNo", "section", "title",
    "pageStart", "pageEnd", "extractionMode", "pdfMd5", "risk", "status",
    "disposition", "reviewer", "reviewedAt", "correctionCount", "evidence", "notes",
]


def existing_rows() -> dict[str, dict[str, str]]:
    if not LEDGER.is_file():
        return {}
    with LEDGER.open("r", encoding="utf-8-sig", newline="") as handle:
        return {row["baselineId"]: row for row in csv.DictReader(handle, delimiter="\t")}


def main() -> int:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    report = json.loads(REPORT.read_text(encoding="utf-8")) if REPORT.is_file() else {"books": {}}
    review_pages = {
        group_id: {item["page"] for item in book.get("reviewPages", [])}
        for group_id, book in report.get("books", {}).items()
    }
    rows = existing_rows()
    for group in manifest["groups"]:
        for summary in group["lessons"]:
            if summary["id"] in rows:
                continue
            detail = json.loads((ROOT / "public" / summary["jsonPath"]).read_text(encoding="utf-8"))
            source = detail["source"]
            pages = set(range(source["pageStart"], source["pageEnd"] + 1))
            flagged = bool(pages & review_pages.get(group["id"], set()))
            risk = "high" if source["extractionMode"] == "ocr" or flagged else "normal"
            rows[summary["id"]] = {
                "baselineId": summary["id"], "groupId": group["id"],
                "unitNo": str(summary["unitNo"]), "sequenceNo": str(summary["sequenceNo"]),
                "section": summary["section"], "title": summary["title"],
                "pageStart": str(source["pageStart"]), "pageEnd": str(source["pageEnd"]),
                "extractionMode": source["extractionMode"], "pdfMd5": source.get("pdfMd5", ""),
                "risk": risk, "status": "pending", "disposition": "",
                "reviewer": "", "reviewedAt": "", "correctionCount": "0",
                "evidence": "", "notes": "",
            }
    group_order = {group["id"]: index for index, group in enumerate(manifest["groups"])}
    ordered = sorted(rows.values(), key=lambda row: (group_order[row["groupId"]], int(row["sequenceNo"])))
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, delimiter="\t", lineterminator="\n")
        writer.writeheader()
        writer.writerows(ordered)
    print(f"Manual review ledger contains {len(ordered)} baseline articles; no article was auto-approved.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
