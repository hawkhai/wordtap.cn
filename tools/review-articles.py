#!/usr/bin/env python3
"""Inventory, inspect, and explicitly record one article at a time."""
from __future__ import annotations

import argparse
import copy
import csv
import json
import hashlib
import re
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from review_archive import evidence_bytes, evidence_exists, evidence_json

from article_review import (ROOT, REVIEW_ROOT, COURSES, DISPLAY_KEYS, candidate,
    canonical_hash, display_hash, display_payload, revision_path, validate_change,
    apply_revision, spacing_edits, sync_summary, generator_baseline_path, without_spacing, verify_source)

LEDGER = REVIEW_ROOT / "ledger.tsv"
EVENTS = REVIEW_ROOT / "events.jsonl"
COLUMNS = ("sequence", "path", "course", "id", "title", "status", "reviewer", "reviewed_at",
    "source_evidence", "before_display_sha256", "after_display_sha256", "spacing_edits",
    "paragraph_edits", "content_corrections", "validation", "notes")
COMPLETE = {"passed_unchanged", "passed_edited"}
STATUSES = {"pending", "in_review", "edited_pending_recheck", "passed_unchanged", "passed_edited", "needs_source_check"}
GROUPS = {
    "shuimu": ("phonetics", "beginner", "intermediate", "upper"),
    "postgraduate": ("volume1", "volume2", "reading-writing-translation"),
    "nce": ("nce1", "nce2", "nce3", "nce4"),
    "pep-english": ("pepj7a", "pepj7b", "pepj8a", "pepj8b", "pepj9", "pephr1", "pephr2", "pephr3", "pephs1", "pephs2", "pephs3", "pephs4"),
}


def read_ledger() -> list[dict]:
    if not LEDGER.exists():
        return []
    with LEDGER.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def write_ledger(rows: list[dict]) -> None:
    REVIEW_ROOT.mkdir(parents=True, exist_ok=True)
    temp = LEDGER.with_suffix(".tmp")
    with temp.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, delimiter="\t", lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    temp.replace(LEDGER)


def load_detail(relative: str) -> tuple[Path, dict]:
    file = (ROOT / relative).resolve()
    if not file.is_relative_to(ROOT / "public") or "lessons" not in file.parts or file.suffix != ".json":
        raise ValueError("Expected a public lesson JSON")
    return file, json.loads(file.read_text(encoding="utf-8-sig"))


def initialize() -> None:
    existing = {row["path"]: row for row in read_ledger()}
    ordered = []
    for course in COURSES:
        files = list((ROOT / "public" / course / "lessons").rglob("*.json"))
        group_order = GROUPS.get(course, tuple(sorted({p.parent.name for p in files})))
        files.sort(key=lambda p: (group_order.index(p.parent.name), p.name))
        ordered.extend((course, p) for p in files)
    rows = []
    source_hashes = {}
    for sequence, (course, p) in enumerate(ordered, 1):
        relative = p.relative_to(ROOT).as_posix()
        d = json.loads(p.read_text(encoding="utf-8-sig"))
        digest = display_hash(d)
        prior = existing.get(relative, {})
        row = {key: "" for key in COLUMNS}
        row.update(prior)
        row.update(sequence=str(sequence), path=relative, course=course, id=d["id"], title=d["title"])
        if not prior:
            row.update(status="pending", before_display_sha256=digest)
        elif prior.get("after_display_sha256") and prior["after_display_sha256"] != digest:
            row.update(status="pending", validation="content_changed_re_review_required")
        elif prior.get("status") in COMPLETE | {"needs_source_check"}:
            revision = json.loads(revision_path(course, d["id"]).read_text(encoding="utf-8"))
            for source in revision["sources"]:
                source_path = Path(source["path"])
                if not source_path.is_absolute(): source_path = ROOT / source_path
                if source_path not in source_hashes:
                    source_hashes[source_path] = hashlib.sha256(evidence_bytes(source_path)).hexdigest() if evidence_exists(source_path) else None
                if source_hashes[source_path] != source["sha256"]:
                    row.update(status="pending", validation="source_changed_re_review_required")
                    break
        rows.append(row)
    write_ledger(rows)
    print(f"Inventoried {len(rows)} articles; " + str(dict(Counter(r['status'] for r in rows))))


def inspect(relative: str | None) -> None:
    if not relative:
        row = next((r for r in read_ledger() if r["status"] not in COMPLETE | {"needs_source_check"}), None)
        if row is None:
            print("No pending articles")
            return
        relative = row["path"]
    _, detail = load_detail(relative)
    proposal = candidate(detail)
    print(json.dumps({"path": relative, "id": detail["id"], "title": detail["title"], "source": detail.get("source"), "candidateEdits": spacing_edits(detail, proposal)}, ensure_ascii=False))
    if "blocks" in detail:
        for index, block in enumerate(detail["blocks"]):
            print(f"[{index}:{block.get('type')}:{block.get('lang', '')}] {block['text']}")
    else:
        print(detail["text"])
        if "bodyTextZh" in detail:
            print("--- Chinese body ---\n" + detail["bodyTextZh"])
    print("--- candidate changes ---")
    if "blocks" in detail:
        for i, (a, b) in enumerate(zip(detail["blocks"], proposal["blocks"])):
            if a["text"] != b["text"]:
                print(f"[{i}] {a['text']}\n => {b['text']}")
    else:
        for key in DISPLAY_KEYS:
            if isinstance(detail.get(key), str) and detail.get(key) != proposal.get(key):
                print(key, proposal[key])


def mark_progress(relative: str, status: str) -> None:
    """Explicit progress only: neither transition records a passing review."""
    rows = read_ledger()
    row = next(r for r in rows if r["path"] == relative)
    if row["status"] in COMPLETE:
        raise ValueError("A passed article needs a content change and init before re-review")
    earlier = [r for r in rows if int(r["sequence"]) < int(row["sequence"]) and r["status"] not in COMPLETE | {"needs_source_check"}]
    if earlier:
        raise ValueError(f"Review earlier article first: {earlier[0]['path']}")
    row["status"] = status
    write_ledger(rows)
    print(f"{relative}: {status}; no passing review recorded")


def prepend_display_blocks(after: dict, before: dict, prefix: dict) -> None:
    """Restore missing introductory display blocks against an exact anchor."""
    if not isinstance(prefix, dict) or not after.get("blocks") or prefix.get("before") != before["blocks"][0]["text"]:
        raise ValueError("Block prefix precondition mismatch")
    added = prefix.get("blocks")
    if not isinstance(added, list) or not added or any(
        not isinstance(b, dict) or set(b) - {"text", "type", "lang"}
        or not isinstance(b.get("text"), str) or not b["text"].strip()
        or b.get("type") not in {"paragraph", "heading", "subheading", "list"}
        for b in added
    ):
        raise ValueError("Invalid display block prefix")
    after["blocks"] = copy.deepcopy(added) + after["blocks"]


def split_display_block(block: dict, operation: dict, run: list[dict] | None = None) -> list[dict]:
    """Split a checked display block without carrying new structural metadata."""
    if operation.get("before") != [item["text"] for item in (run or [block])]:
        raise ValueError("Block split precondition mismatch")
    pieces = operation.get("blocks")
    if not isinstance(pieces, list) or len(pieces) < 2:
        raise ValueError("Block split needs at least two display blocks")
    for piece in pieces:
        if not isinstance(piece, dict) or set(piece) - {"text", "type", "lang"} or not isinstance(piece.get("text"), str) or not piece["text"].strip() or piece.get("type", block.get("type")) not in {"paragraph", "heading", "subheading", "list"}:
            raise ValueError("Invalid split display block")
    return [{**block, **copy.deepcopy(piece)} for piece in pieces]


def record(relative: str, decision: dict) -> None:
    """Called with an explicitly authored decision AFTER reading and rechecking.

    No loop or candidate generator calls this function to grant approval.
    """
    rows = read_ledger()
    row = next(r for r in rows if r["path"] == relative)
    # Re-review stays on the same article until its final record is written.
    earlier = [r for r in rows if int(r["sequence"]) < int(row["sequence"]) and r["status"] not in COMPLETE | {"needs_source_check"}]
    if earlier:
        raise ValueError(f"Review earlier article first: {earlier[0]['path']}")
    file, before = load_detail(relative)
    segmentation = decision.get("reviewMode") == "json-segmentation-v1"
    if segmentation:
        from segmentation_review import validate_decision
        validate_decision(before, decision)
    if row["status"] in COMPLETE and not segmentation:
        raise ValueError("Already reviewed; use init after a content change")
    sources = decision.get("sources", [])
    if not isinstance(decision.get("issues", []), list) or any(not isinstance(issue, str) for issue in decision.get("issues", [])):
        raise ValueError("Review issues must be a list of explanatory strings")
    if not sources or not decision.get("notes"):
        raise ValueError("Explicit source evidence and review notes required")
    for source in sources:
        source_file = Path(source["path"])
        if not source_file.is_absolute():
            source_file = ROOT / source_file
        if not evidence_exists(source_file):
            raise ValueError(f"Source missing: {source_file}")
        if not source.get("locator") or not source.get("checked"):
            raise ValueError("Source locator and explicit check confirmation required")
        source["sha256"] = hashlib.sha256(evidence_bytes(source_file)).hexdigest()
    if decision.get("fullReadConfirmed") is not True or decision.get("recheckConfirmed") is not True:
        raise ValueError("Explicit full-read and recheck confirmation required")
    after = candidate(before) if decision.get("useSpacingCandidate", True) else copy.deepcopy(before)
    for key, value in decision.get("display", {}).items():
        if key not in DISPLAY_KEYS:
            raise ValueError(f"Not a display field: {key}")
        after[key] = value
    for edit in decision.get("blockEdits", []):
        index = edit["index"]
        if after["blocks"][index]["text"] != edit["before"]:
            raise ValueError("Block edit precondition mismatch")
        after["blocks"][index].update({k: edit[k] for k in ("text", "type", "lang") if k in edit})
    # Ranges refer to the spacing candidate; apply descending to preserve indices.
    operations = decision.get("mergeBlocks", []) + [dict(item, remove=True) for item in decision.get("removeBlocks", [])] + [dict(item, start=item["index"], end=item.get("end", item["index"]), split=True) for item in decision.get("splitBlocks", [])]
    ranges = sorted((item["start"], item["end"]) for item in operations)
    if any(a > b or a < 0 or b >= len(after.get("blocks", [])) for a, b in ranges) or any(left[1] >= right[0] for left, right in zip(ranges, ranges[1:])):
        raise ValueError("Invalid or overlapping block operation ranges")
    for merge in sorted(operations, key=lambda m: m["start"], reverse=True):
        run = after["blocks"][merge["start"]:merge["end"] + 1]
        if [b["text"] for b in run] != merge["before"]:
            raise ValueError("Block merge precondition mismatch")
        replacement = split_display_block(run[0], merge, run) if merge.get("split") else ([] if merge.get("remove") else [{**run[0], "text": merge["text"]}])
        after["blocks"][merge["start"]:merge["end"] + 1] = replacement
    prefix = decision.get("prependBlocks")
    if prefix is not None:
        prepend_display_blocks(after, before, prefix)
    if "blocks" in after:
        after["text"] = "\n".join(b["text"] for b in after["blocks"])
    if "characterCount" in after:
        after["characterCount"] = len(after["text"])
    corrections = decision.get("corrections", [])
    validate_change(before, after, corrections)
    if segmentation:
        from segmentation_review import validate_layout_change
        validate_layout_change(before, after)
    revision = {
        "schemaVersion": 1, "course": row["course"], "articleId": row["id"],
        "beforeDisplaySha256": display_hash(before), "afterDisplaySha256": display_hash(after),
        "baselineDisplay": display_payload(before), "display": display_payload(after),
        "sources": sources, "corrections": corrections,
        "fullReadConfirmed": True, "recheckConfirmed": True,
        "reviewer": "Codex", "reviewedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "notes": decision["notes"], "issues": decision.get("issues", []),
    }
    if segmentation:
        revision["reviewMode"] = "json-segmentation-v1"
        revision["segmentationReview"] = {
            "beforeFileSha256": canonical_hash(before), "afterFileSha256": canonical_hash(after),
            "decision": copy.deepcopy(decision),
        }
        from segmentation_review import validate_revision
        validate_revision(revision)
    revised = revision["beforeDisplaySha256"] != revision["afterDisplaySha256"]
    # A needs-source record may still contain verified safe spacing changes.
    status = "needs_source_check" if revision["issues"] else ("passed_edited" if revised else "passed_unchanged")
    revision["status"] = status
    if revised and row["course"] == "college-english":
        from college_english_review import validate_signed_display
        validate_signed_display(after)
    rev_file = revision_path(row["course"], row["id"])
    rev_file.parent.mkdir(parents=True, exist_ok=True)
    if rev_file.exists():
        previous_revision = json.loads(rev_file.read_text(encoding="utf-8"))
        previous_hash = canonical_hash(previous_revision)
        archive = REVIEW_ROOT / "history" / f"{previous_hash}.json"
        archive.parent.mkdir(parents=True, exist_ok=True)
        if evidence_exists(archive) and evidence_json(archive) != previous_revision:
            raise ValueError("Historical revision evidence changed")
        if not evidence_exists(archive):
            archive.write_text(json.dumps(previous_revision, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        revision["previousRevisionSha256"] = previous_hash
    rev_file.write_text(json.dumps(revision, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # Exercise generator replay and idempotence before publishing any text.
    replayed = apply_revision(before, row["course"])
    if replayed != after or apply_revision(replayed, row["course"]) != replayed:
        raise ValueError("Revision replay/idempotence failed")
    paragraph_count = len(operations) + sum("type" in b for b in decision.get("blockEdits", [])) + (len(prefix["blocks"]) if prefix else 0)
    publish_record(relative, before, after, revision, paragraph_count)

def write_json_atomic(path: Path, value: dict) -> None:
    temporary = path.with_suffix(path.suffix + ".review-tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for attempt in range(8):
        try:
            temporary.replace(path)
            break
        except PermissionError:
            if attempt == 7:
                raise
            time.sleep(0.1 * (attempt + 1))


def publish_record(relative: str, before: dict, after: dict, revision: dict, paragraph_count: int) -> None:
    """Finish a validated revision, including retry after a publishing interruption."""
    rows = read_ledger()
    row = next(r for r in rows if r["path"] == relative)
    file = ROOT / relative
    revised = revision["beforeDisplaySha256"] != revision["afterDisplaySha256"]
    status, sources, corrections = revision["status"], revision["sources"], revision["corrections"]
    if revised:
        write_json_atomic(file, after)
        manifest_path = ROOT / "public" / row["course"] / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        def update(value: object) -> None:
            if isinstance(value, dict):
                if value.get("jsonPath") == before.get("jsonPath"):
                    sync_summary(value, after)
                else:
                    for child in value.values():
                        update(child)
            elif isinstance(value, list):
                for child in value:
                    update(child)
        update(manifest)
        write_json_atomic(manifest_path, manifest)
    spacing_count = spacing_edits(before, after)
    row.update(title=after["title"], status=status, reviewer="Codex", reviewed_at=revision["reviewedAt"],
        source_evidence=json.dumps(sources, ensure_ascii=False, separators=(",", ":")),
        before_display_sha256=revision["beforeDisplaySha256"], after_display_sha256=revision["afterDisplaySha256"],
        spacing_edits=str(spacing_count), paragraph_edits=str(paragraph_count), content_corrections=str(len(corrections)),
        validation="json;immutable_fields;text_consistency;content_evidence;revision_replay;idempotence", notes=revision["notes"] + ("; " + "; ".join(revision["issues"]) if revision["issues"] else ""))
    previous = ""
    if EVENTS.exists():
        last = EVENTS.read_text(encoding="utf-8").splitlines()
        previous = json.loads(last[-1])["eventSha256"] if last else ""
    event = {"path": relative, "status": status, "reviewedAt": revision["reviewedAt"], "revisionSha256": canonical_hash(revision), "previousEventSha256": previous}
    event["eventSha256"] = canonical_hash(event)
    latest = next((json.loads(raw) for raw in reversed(last) if json.loads(raw)["path"] == relative), None) if EVENTS.exists() else None
    if latest is None or latest["revisionSha256"] != event["revisionSha256"]:
        with EVENTS.open("a", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")
    write_ledger(rows)
    print(f"{row['sequence']}/{len(rows)} {row['course']}/{row['id']}: {status}; edits={spacing_count}; paragraphs={paragraph_count}; corrections={len(corrections)}")


def verify(require_complete: bool = False, *, published_only: bool = False) -> None:
    """Check published evidence; the default additionally reopens every raw source.

    The explicit published-only build gate is portable without local source PDFs.
    It still checks coverage, display hashes, corrections and all revision events.
    It must never be reported as a fresh source-backed editorial verification.
    """
    rows = read_ledger()
    actual = {p.relative_to(ROOT).as_posix() for course in COURSES for p in (ROOT / "public" / course / "lessons").rglob("*.json")}
    if actual != {r["path"] for r in rows} or len(rows) != len(actual):
        raise ValueError("Article inventory missing/duplicate/stale rows")
    if any(r["status"] not in STATUSES for r in rows):
        raise ValueError("Unknown review status")
    previous = ""
    events_by_path = {}
    for raw in EVENTS.read_text(encoding="utf-8").splitlines() if EVENTS.exists() else []:
        event = json.loads(raw)
        unsigned = {k: v for k, v in event.items() if k != "eventSha256"}
        if canonical_hash(unsigned) != event["eventSha256"] or event["previousEventSha256"] != previous:
            raise ValueError("Invalid review event hash chain")
        previous = event["eventSha256"]
        events_by_path[event["path"]] = event
    for row in rows:
        _, detail = load_detail(row["path"])
        if row["status"] in {"pending", "in_review", "edited_pending_recheck"}:
            continue
        revision = json.loads(revision_path(row["course"], row["id"]).read_text(encoding="utf-8"))
        if revision.get("reviewMode") == "json-segmentation-v1":
            from segmentation_review import validate_revision
            validate_revision(revision)
        if display_hash(detail) != row["after_display_sha256"] or display_hash(detail) != revision["afterDisplaySha256"]:
            raise ValueError(f"{row['path']}: reviewed content changed")
        if canonical_hash(revision) != events_by_path[row["path"]]["revisionSha256"]:
            raise ValueError("Recorded review evidence changed")
        if revision["display"] != display_payload(detail):
            raise ValueError("Recorded display does not match published article")
        if revision.get("ruleRestoration"):
            from article_cleanup import restoration_evidence
            proof = restoration_evidence(revision, row["course"], row["id"])
            if (proof["originRevisionSha256"] != revision.get("previousRevisionSha256")
                    or proof["afterDisplaySha256"] != display_hash(detail)
                    or revision.get("fullReadConfirmed") is not False):
                raise ValueError("Rule restoration proof mismatch")
        baseline = copy.deepcopy(detail)
        for key, value in revision["baselineDisplay"].items():
            if key == "sentences":
                for s, v in zip(baseline[key], value):
                    s.update(v)
            else:
                baseline[key] = value
        if "characterCount" in baseline:
            baseline["characterCount"] = len(baseline["text"])
        validate_change(baseline, detail, revision.get("corrections"))
        if not published_only and apply_revision(baseline, row["course"]) != detail:
            raise ValueError("Revision does not reproduce published article")
        proof_file = generator_baseline_path(row["course"], row["id"])
        if proof_file.exists():
            proof = json.loads(proof_file.read_text(encoding="utf-8"))
            if proof["proofSha256"] != canonical_hash({k: v for k, v in proof.items() if k != "proofSha256"}):
                raise ValueError("Generator baseline proof hash mismatch")
            from article_review import find_baseline_revision, validate_generator_baseline
            proof_revision = find_baseline_revision(revision, proof["publicBeforeDisplaySha256"])
            validate_generator_baseline(proof["display"], proof_revision["baselineDisplay"], proof.get("blockTypeChanges"))
            if not published_only:
                verify_source(proof["source"])
        for source in ([] if published_only else revision["sources"]):
            verify_source(source)
    # Superseded records remain auditable even after a new baseline is reviewed.
    for event in (json.loads(raw) for raw in EVENTS.read_text(encoding="utf-8").splitlines()) if EVENTS.exists() else []:
        if events_by_path[event["path"]] == event:
            continue
        archived = REVIEW_ROOT / "history" / f"{event['revisionSha256']}.json"
        if not evidence_exists(archived) or canonical_hash(evidence_json(archived)) != event["revisionSha256"]:
            raise ValueError("Historical review evidence missing/changed")
    counts = dict(Counter(r["status"] for r in rows))
    label = "Verified published snapshot (raw sources not reopened):" if published_only else "Verified"
    print(f"{label} {len(rows)} inventory rows, {len(events_by_path)} review records: {counts}")
    if require_complete and any(r["status"] not in COMPLETE for r in rows):
        raise ValueError("Full review is incomplete: pending/source-check articles remain")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser()
    p.add_argument("action", choices=("init", "inspect", "start", "recheck", "record", "verify", "verify-published"))
    p.add_argument("--path")
    p.add_argument("--decision", type=Path)
    p.add_argument("--require-complete", action="store_true")
    args = p.parse_args()
    if args.action == "init": initialize()
    elif args.action == "inspect": inspect(args.path)
    elif args.action in {"verify", "verify-published"}:
        verify(args.require_complete, published_only=args.action == "verify-published")
    elif args.action in {"start", "recheck"}:
        if not args.path: p.error("progress transition requires --path")
        mark_progress(args.path, "in_review" if args.action == "start" else "edited_pending_recheck")
    elif not args.path or not args.decision: p.error("record requires --path and --decision")
    else: record(args.path, json.loads(args.decision.read_text(encoding="utf-8-sig")))


if __name__ == "__main__":
    main()
