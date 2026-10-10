#!/usr/bin/env python3
"""Inventory/scan/read/record/check JSON-only article segmentation reviews."""
from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import sys
from collections import Counter
from pathlib import Path

import article_review as review
from review_archive import evidence_exists, evidence_json
from segmentation_review import MODE, COMPLETE, STATUSES, candidates, validate_decision, validate_revision, before_snapshot, validate_layout_change

ROOT = review.ROOT
DIRECTORY = review.REVIEW_ROOT / "segmentation"
LEDGER = DIRECTORY / "ledger.tsv"
COLUMNS = ("sequence", "path", "course", "id", "title", "status", "before_file_sha256", "after_file_sha256",
           "candidate_count", "full_read_confirmed", "recheck_confirmed", "reviewed_at", "revision_sha256", "notes")
EXAMPLE = "public/shuimu/lessons/intermediate/061.json"
COURSE_COUNTS = dict(zip(review.COURSES, (192, 40, 276, 313, 72, 97, 64)))


def load(path):
    return evidence_json(path)


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


def article_cli():
    spec = importlib.util.spec_from_file_location("article_review_cli", Path(__file__).with_name("review-articles.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def rows():
    if not LEDGER.exists():
        return []
    with LEDGER.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle, delimiter="\t"))


def save(entries):
    DIRECTORY.mkdir(parents=True, exist_ok=True)
    temp = LEDGER.with_suffix(".tmp")
    with temp.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS, delimiter="\t", lineterminator="\n")
        writer.writeheader(); writer.writerows(entries)
    temp.replace(LEDGER)
    summary = {"reviewMode": MODE, "total": len(entries), "statuses": dict(Counter(r["status"] for r in entries)),
               "courses": {course: dict(Counter(r["status"] for r in entries if r["course"] == course)) for course in review.COURSES},
               "remaining": [r["path"] for r in entries if r["status"] not in COMPLETE]}
    write_json(DIRECTORY / "summary.json", summary)


def initialize():
    prior = {r["path"]: r for r in rows()}
    entries = []
    inventory = article_cli().read_ledger()
    actual = {p.relative_to(ROOT).as_posix() for course in review.COURSES for p in (ROOT / "public" / course / "lessons").rglob("*.json")}
    if len(inventory) != 1054 or len(actual) != 1054 or actual != {r["path"] for r in inventory}:
        raise ValueError("Expected exactly 1054 unique published articles")
    if Counter(r["course"] for r in inventory) != COURSE_COUNTS:
        raise ValueError("Course inventory counts changed")
    for original in inventory:
        detail = load(ROOT / original["path"])
        digest = review.canonical_hash(detail)
        row = dict.fromkeys(COLUMNS, "")
        row.update({k: original[k] for k in ("sequence", "path", "course", "id", "title")})
        row.update(prior.get(row["path"], {}))
        row["candidate_count"] = str(len(candidates(detail)))
        if row["path"] not in prior:
            row.update(status="pending", before_file_sha256=digest, full_read_confirmed="false", recheck_confirmed="false")
        elif digest != (row["after_file_sha256"] or row["before_file_sha256"]):
            row.update(status="pending", before_file_sha256=digest, after_file_sha256="", revision_sha256="",
                       full_read_confirmed="false", recheck_confirmed="false", reviewed_at="", notes="JSON changed; re-review required")
        entries.append(row)
    save(entries)
    print(json.dumps(dict(Counter(r["status"] for r in entries))))


def record(relative, decision):
    entries = rows()
    row = next(r for r in entries if r["path"] == relative)
    if decision.get("reviewMode") != MODE:
        raise ValueError("Explicit JSON-only review mode required")
    detail = load(ROOT / relative)
    latest_file = review.revision_path(row["course"], row["id"])
    previous = load(latest_file)
    existing = previous.get("segmentationReview", {}).get("decision", {})
    # A rerun after interruption finishes the ledger without appending a second revision.
    authored_fields = lambda value: {k: v for k, v in value.items() if k != "sources"}
    recovered = (authored_fields(existing) == authored_fields(decision) and previous.get("reviewMode") == MODE
                 and previous["segmentationReview"]["afterFileSha256"] == review.canonical_hash(detail))
    if not recovered:
        validate_decision(detail, decision)
        if row["status"] in COMPLETE and decision.get("revisit") is not True:
            raise ValueError("Already reviewed; initialize changed content before reviewing again")
        earlier = [r for r in entries if int(r["sequence"]) < int(row["sequence"]) and r["status"] not in COMPLETE | {"needs_confirmation"}]
        if (relative != EXAMPLE and earlier and decision.get("revisit") is not True
                and decision.get("parallelReview") is not True):
            raise ValueError(f"Review earlier article first: {earlier[0]['path']}")
        previous_hash = review.canonical_hash(previous)
        archived = review.REVIEW_ROOT / "history" / f"{previous_hash}.json"
        if evidence_exists(archived) and load(archived) != previous:
            raise ValueError("Archived baseline changed")
        if not evidence_exists(archived):
            write_json(archived, previous)
        authored = dict(decision)
        # The immutable JSON baseline is the only source opened by replay.
        authored["sources"] = [{"path": archived.relative_to(ROOT).as_posix(), "locator": "display: complete published JSON baseline; contextual segmentation review only", "checked": True}]
        article_cli().record(relative, authored)
        previous = load(latest_file)
        # Persist the exact normalized decision for interruption recovery.
        decision = previous["segmentationReview"]["decision"]
        detail = load(ROOT / relative)
    else:
        decision = existing
        validate_revision(previous)
        before = before_snapshot(detail, previous)
        paragraph_count = (len(decision.get("mergeBlocks", [])) + len(decision.get("splitBlocks", []))
                           + sum("type" in b for b in decision.get("blockEdits", [])))
        article_cli().publish_record(relative, before, detail, previous, paragraph_count)
    validate_revision(previous)
    row.update(status="needs_confirmation" if previous["issues"] else previous["status"],
               before_file_sha256=previous["segmentationReview"]["beforeFileSha256"],
               after_file_sha256=review.canonical_hash(detail), candidate_count=str(len(candidates(detail))),
               full_read_confirmed="true", recheck_confirmed="true", reviewed_at=previous["reviewedAt"],
               revision_sha256=review.canonical_hash(previous), notes=previous["notes"])
    write_json(DIRECTORY / "decisions" / row["course"] / f"{row['id']}.json", decision)
    save(entries)
    print(f"JSON-only review: {relative}: {row['status']}")


def check(require_complete=False):
    entries = rows()
    actual = {p.relative_to(ROOT).as_posix() for course in review.COURSES for p in (ROOT / "public" / course / "lessons").rglob("*.json")}
    if len(entries) != 1054 or len(actual) != 1054 or actual != {r["path"] for r in entries}:
        raise ValueError("Segmentation inventory missing/duplicate/stale rows")
    if Counter(r["course"] for r in entries) != COURSE_COUNTS:
        raise ValueError("Course inventory counts changed")
    for row in entries:
        detail = load(ROOT / row["path"])
        validate_layout_change(detail, detail)
        if row["id"] != detail["id"] or not row["path"].startswith(f"public/{row['course']}/lessons/"):
            raise ValueError("Article identity mismatch")
        if row["status"] not in STATUSES:
            raise ValueError("Unknown segmentation status")
        if review.canonical_hash(detail) != (row["after_file_sha256"] or row["before_file_sha256"]):
            raise ValueError(f"JSON changed since inventory/review: {row['path']}")
        if row["status"] not in COMPLETE | {"needs_confirmation"}:
            continue
        revision = load(review.revision_path(row["course"], row["id"]))
        validate_revision(revision)
        decision = load(DIRECTORY / "decisions" / row["course"] / f"{row['id']}.json")
        if (review.canonical_hash(revision) != row["revision_sha256"]
                or revision["segmentationReview"]["decision"] != decision
                or revision["segmentationReview"]["beforeFileSha256"] != row["before_file_sha256"]
                or revision["segmentationReview"]["afterFileSha256"] != row["after_file_sha256"]
                or row["full_read_confirmed"] != "true" or row["recheck_confirmed"] != "true"
                or (row["status"] in COMPLETE and row["status"] != revision["status"])
                or (bool(revision["issues"]) != (row["status"] == "needs_confirmation"))):
            raise ValueError(f"Review evidence mismatch: {row['path']}")
        if review.display_payload(detail) != revision["display"]:
            raise ValueError("Published JSON differs from reviewed display")
        # Current revision sources are JSON snapshots only, never original PDFs.
        expected_source = review.REVIEW_ROOT / "history" / f"{revision['previousRevisionSha256']}.json"
        if (len(revision["sources"]) != 1
                or (ROOT / revision["sources"][0]["path"]).resolve() != expected_source.resolve()):
            raise ValueError("JSON review must reference its archived revision only")
        review.verify_source(revision["sources"][0])
        baseline = load(expected_source)
        if (review.canonical_hash(baseline) != revision["previousRevisionSha256"]
                or baseline["display"] != revision["baselineDisplay"]):
            raise ValueError("JSON baseline differs from reviewed input")
        before = before_snapshot(detail, revision)
        if review.apply_revision(before, row["course"]) != detail or review.apply_revision(detail, row["course"]) != detail:
            raise ValueError("Published snapshot replay/idempotence mismatch")
    counts = dict(Counter(r["status"] for r in entries))
    print(f"Verified {len(entries)} JSON inventory rows: {counts}")
    if require_complete and any(r["status"] not in COMPLETE for r in entries):
        raise ValueError("Segmentation review incomplete: pending/needs-confirmation articles remain")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("init", "scan", "read", "record", "check", "start"))
    parser.add_argument("--path")
    parser.add_argument("--decision", type=Path)
    parser.add_argument("--require-complete", action="store_true")
    args = parser.parse_args()
    if args.action == "init": initialize()
    elif args.action == "check": check(args.require_complete)
    elif args.action == "scan":
        output = []
        for row in rows():
            if args.path and row["path"] != args.path: continue
            detail = load(ROOT / row["path"])
            output.append({"path": row["path"], "fileSha256": review.canonical_hash(detail), "findings": candidates(detail)})
        write_json(DIRECTORY / "candidates.json", {"machineOnly": True, "articles": output})
        print(f"Scanned {len(output)} articles; no review statuses changed")
    elif args.action == "read":
        if not args.path: parser.error("read requires --path")
        _, detail = article_cli().load_detail(args.path)
        print(f"SHA256 {review.canonical_hash(detail)}")
        if "blocks" in detail:
            for i, block in enumerate(detail["blocks"]): print(f"[{i}:{block['type']}] {block['text']}")
        else:
            for field in ("text", "bodyTextZh"):
                print(f"[{field}]\n{detail.get(field, '')}")
    elif args.action == "start":
        if not args.path: parser.error("start requires --path")
        entries = rows(); row = next(r for r in entries if r["path"] == args.path)
        if row["status"] in COMPLETE: raise ValueError("Already reviewed")
        row["status"] = "in_review"; save(entries)
    else:
        if not args.path or not args.decision: parser.error("record requires --path and --decision")
        record(args.path, load(args.decision))


if __name__ == "__main__":
    main()
