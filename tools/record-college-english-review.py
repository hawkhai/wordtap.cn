#!/usr/bin/env python3
"""Append one explicitly authored College English review event.

The command cannot discover or approve articles automatically. Passing requires
an explicit full-read confirmation, a reviewed article file, evidence, and a
named reviewer.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone

from college_english_review import (
    EVENTS_PATH,
    load_catalog,
    load_events,
    load_ledger,
    payload_sha256,
    reviewed_article,
    write_ledger,
)


TRANSITIONS = {
    "pending": {"in_review"},
    "in_review": {"needs_fix", "recheck"},
    "needs_fix": {"recheck"},
    "recheck": {"needs_fix", "passed"},
    "passed": set(),
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--article", required=True)
    parser.add_argument("--to", required=True, choices=TRANSITIONS)
    parser.add_argument("--reviewer", required=True)
    parser.add_argument("--evidence", required=True)
    parser.add_argument("--notes", default="")
    parser.add_argument("--correction-count", type=int, default=0)
    parser.add_argument("--confirm-full-read", action="store_true")
    args = parser.parse_args()

    if not args.reviewer.strip() or not args.evidence.strip():
        raise RuntimeError("Reviewer and evidence must be non-empty")
    if args.correction_count < 0:
        raise RuntimeError("Correction count cannot be negative")

    fields, rows = load_ledger()
    row_index = next((index for index, row in enumerate(rows) if row["baselineId"] == args.article), None)
    if row_index is None:
        raise RuntimeError(f"Unknown article: {args.article}")
    row = rows[row_index]
    from_status = row["status"]
    if args.to not in TRANSITIONS.get(from_status, set()):
        raise RuntimeError(f"{args.article}: invalid transition {from_status} -> {args.to}")

    events = load_events()
    catalog = load_catalog()
    catalog_article = next(item for item in catalog["articles"] if item["id"] == args.article)
    catalog_book = next(item for item in catalog["books"] if item["id"] == row["groupId"])
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    after_hash = row.get("textSha256", "")
    reviewed_payload = None
    if args.to in {"recheck", "passed"}:
        payload, _, after_hash = reviewed_article(args.article)
        reviewed_payload = payload
        if payload.get("title") != catalog_article["title"]:
            raise RuntimeError(f"{args.article}: reviewed title differs from the textbook directory")
        if payload.get("unitNo") != int(row["unitNo"]) or payload.get("section") != row["section"]:
            raise RuntimeError(f"{args.article}: reviewed unit/section differs from the ledger")
        if not (
            catalog_article["printedPageStart"] <= payload["printedPageStart"]
            <= payload["printedPageEnd"] <= catalog_article["printedPageEnd"]
        ):
            raise RuntimeError(f"{args.article}: reviewed page boundary leaves the directory-defined candidate span")
        row["printedPageStart"] = str(payload["printedPageStart"])
        row["printedPageEnd"] = str(payload["printedPageEnd"])
        offset = catalog_article["pdfPageStart"] - catalog_article["printedPageStart"]
        row["pdfPageStart"] = str(payload["printedPageStart"] + offset)
        row["pdfPageEnd"] = str(payload["printedPageEnd"] + offset)
        row["ocrPageStart"] = row["pdfPageStart"]
        row["ocrPageEnd"] = row["pdfPageEnd"]
        row["ocrPageCount"] = str(payload["printedPageEnd"] - payload["printedPageStart"] + 1)
    if args.to == "passed":
        if not args.confirm_full_read:
            raise RuntimeError("Passing requires --confirm-full-read")
        earlier = rows[:row_index]
        if any(item["status"] != "passed" for item in earlier):
            raise RuntimeError(f"{args.article}: earlier textbook articles are not all passed")

    event = {
        "schemaVersion": 1,
        "articleId": args.article,
        "sequenceNo": int(row["sequenceNo"]),
        "fromStatus": from_status,
        "toStatus": args.to,
        "reviewer": args.reviewer.strip(),
        "reviewedAt": now,
        "sourcePdfSha256": catalog_book["pdfSha256"],
        "sourcePages": {
            "printed": [int(row["printedPageStart"]), int(row["printedPageEnd"])],
            "pdf": [int(row["pdfPageStart"]), int(row["pdfPageEnd"])],
        },
        "beforeTextSha256": row.get("textSha256", ""),
        "afterTextSha256": after_hash,
        "correctionCount": args.correction_count,
        "evidence": args.evidence.strip(),
        "notes": args.notes.strip(),
        "fullReadConfirmed": bool(args.confirm_full_read),
        "previousEventSha256": events[-1]["eventSha256"] if events else "",
    }
    event["eventSha256"] = payload_sha256(event)
    with EVENTS_PATH.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")

    row["status"] = args.to
    row["reviewer"] = args.reviewer.strip()
    row["evidence"] = args.evidence.strip()
    row["correctionCount"] = str(args.correction_count)
    row["textSha256"] = after_hash
    row["eventSha256"] = event["eventSha256"]
    row["notes"] = args.notes.strip()
    if args.to == "in_review":
        row["startedAt"] = now
    if args.to == "passed":
        row["reviewedAt"] = now
        row["disposition"] = "retained-reviewed"
    rows[row_index] = row
    write_ledger(fields, rows)
    print(f"Recorded {args.article}: {from_status} -> {args.to}; event {event['eventSha256']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
