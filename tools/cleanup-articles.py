#!/usr/bin/env python3
"""Preview/apply/check the user-requested 1,054-article editorial rollback."""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import article_review as review
import college_english_review as college
from article_cleanup import POLICY, REPORT, clean_display, restore_display, reversal_corrections

ROOT = review.ROOT
REPORT_PATH = ROOT / REPORT


def load(path): return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()


def archive_source(path):
    target = review.REVIEW_ROOT / "source-history" / digest(path)
    if target.exists():
        if target.read_bytes() != path.read_bytes(): raise ValueError("Source archive collision")
    else:
        target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(path.read_bytes())


def archive_revision(revision):
    target = review.REVIEW_ROOT / "history" / f"{review.canonical_hash(revision)}.json"
    if target.exists() and load(target) != revision: raise ValueError("Revision archive collision")
    if not target.exists(): write(target, revision)


def cli_module():
    spec = importlib.util.spec_from_file_location("review_cli", ROOT / "tools/review-articles.py")
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def prepare():
    cli = cli_module(); rows = cli.read_ledger(); plans = []
    if len(rows) != 1054: raise ValueError("Expected the complete 1,054-article inventory")
    for row in rows:
        before = load(ROOT / row["path"])
        revision = load(review.revision_path(row["course"], row["id"]))
        if review.display_hash(before) != revision["afterDisplaySha256"]:
            raise ValueError(f"Stale reviewed article: {row['path']}")
        payload, audit = clean_display(revision, before)
        after = restore_display(before, payload)
        corrections = reversal_corrections(before, after)
        review.validate_change(before, after, corrections)
        changed = review.display_hash(before) != review.display_hash(after)
        audit.update(path=row["path"], course=row["course"], articleId=row["id"], changed=changed,
                     beforeDisplaySha256=review.display_hash(before), afterDisplaySha256=review.display_hash(after),
                     afterTextSha256=college.text_sha256(after["text"]))
        if row["course"] == "college-english":
            audit["beforeSignedTextSha256"] = college.reviewed_article(row["id"])[2]
        plans.append((row, before, after, revision, corrections, audit))
    return cli, rows, plans


def update_summary(node, detail):
    if isinstance(node, dict):
        if node.get("jsonPath") == detail.get("jsonPath"):
            review.sync_summary(node, detail)
            if "manualReview" in node: node["manualReview"] = copy.deepcopy(detail["manualReview"])
        else:
            for value in node.values(): update_summary(value, detail)
    elif isinstance(node, list):
        for value in node: update_summary(value, detail)


def restore_college(plans, now, report_sha):
    fields, rows = college.load_ledger(); events = college.load_events()
    college.validate_passed_rows(rows, events)
    for row, before, after, _, _, audit in plans:
        if row["course"] != "college-english" or not audit["changed"]: continue
        record = next(r for r in rows if r["baselineId"] == row["id"])
        previous = next(e for e in reversed(events) if e["articleId"] == row["id"] and e["toStatus"] == "passed")
        source_path = college.REVIEWED_ROOT / f"{row['id']}.json"
        archive_source(source_path)
        source = load(source_path)
        source.update(title=after["title"], paragraphs=[b["text"] for b in after["blocks"]])
        if "text" in source: source["text"] = after["text"]
        source.setdefault("correctionLog", []).append(f"User-directed rule restoration; {REPORT}. No new full-read claim.")
        write(source_path, source)
        event = {k: copy.deepcopy(v) for k, v in previous.items() if k not in {"eventSha256"}}
        event.update(eventType="revision", fromStatus="passed", toStatus="passed", reviewer="Codex (user-directed restoration)",
                     reviewedAt=now, beforeTextSha256=previous["afterTextSha256"], afterTextSha256=college.text_sha256(after["text"]),
                     supersedesEventSha256=previous["eventSha256"], previousEventSha256=events[-1]["eventSha256"],
                     evidence=REPORT, notes="Deterministic restoration of historical text; not a new full-read/source-fact review.",
                     fullReadConfirmed=False, ruleRestoration={"policy": POLICY, "report": REPORT, "reportSha256": report_sha},
                     correctionCount=sum(a["action"] == "restore_before_edit" for a in audit["actions"]))
        event["eventSha256"] = college.payload_sha256(event)
        with college.EVENTS_PATH.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")
        events.append(event)
        for key in ("reviewer", "reviewedAt", "evidence", "notes", "eventSha256"):
            record[key] = event[key]
        record.update(textSha256=event["afterTextSha256"], correctionCount=str(event["correctionCount"]), disposition="restored-by-user-rule")
        after["manualReview"] = {k: event[k] for k in ("reviewer", "reviewedAt", "correctionCount", "evidence", "eventSha256")}
        after["manualReview"].update(status="passed", textSha256=event["afterTextSha256"])
    college.write_ledger(fields, rows)
    college.validate_passed_rows(rows, events)


def apply(cli, rows, plans):
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    report = {"schemaVersion": 1, "policy": POLICY, "createdAt": now, "scope": len(plans),
              "reviewMode": "automatic restoration explicitly requested by user; no new full-read or external fact checking",
              "changed": sum(p[5]["changed"] for p in plans), "articles": [p[5] for p in plans]}
    # All calculations and structural validation finish before any lesson writes.
    write(REPORT_PATH, report); report_sha = digest(REPORT_PATH)
    archive_source(ROOT / "tools/shuimu-reviewed-corrections.json")
    for _, _, _, previous, _, _ in plans: archive_revision(previous)
    restore_college(plans, now, report_sha)
    manifests = {course: load(ROOT / "public" / course / "manifest.json") for course in review.COURSES}
    previous_event = json.loads(cli.EVENTS.read_text(encoding="utf-8").splitlines()[-1])["eventSha256"]
    for row, before, after, previous, corrections, audit in plans:
        if not audit["changed"]: continue
        sources = [s for s in previous["sources"] if "reviewed-articles" not in s["path"].lower()]
        sources.append({"path": REPORT, "sha256": report_sha, "locator": row["path"], "checked": True})
        revision = {"schemaVersion": 1, "course": row["course"], "articleId": row["id"],
                    "beforeDisplaySha256": review.display_hash(before), "afterDisplaySha256": review.display_hash(after),
                    "baselineDisplay": review.display_payload(before), "display": review.display_payload(after),
                    "sources": sources, "corrections": corrections, "fullReadConfirmed": False, "recheckConfirmed": False,
                    "reviewMode": POLICY, "reviewer": "Codex (user-directed restoration)", "reviewedAt": now,
                    "notes": "Rule-based restoration; original full-read review remains historical. " + REPORT,
                    "issues": [], "status": "passed_edited", "previousRevisionSha256": review.canonical_hash(previous),
                    "ruleRestoration": {"policy": POLICY, "report": REPORT, "reportSha256": report_sha}}
        write(review.revision_path(row["course"], row["id"]), revision)
        write(ROOT / row["path"], after)
        update_summary(manifests[row["course"]], after)
        event = {"path": row["path"], "status": revision["status"], "reviewedAt": now,
                 "revisionSha256": review.canonical_hash(revision), "previousEventSha256": previous_event,
                 "reviewMode": POLICY}
        event["eventSha256"] = review.canonical_hash(event); previous_event = event["eventSha256"]
        with cli.EVENTS.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")
        row.update(title=after["title"], status=revision["status"], reviewer=revision["reviewer"], reviewed_at=now,
                   source_evidence=json.dumps(sources, ensure_ascii=False, separators=(",", ":")),
                   before_display_sha256=revision["beforeDisplaySha256"], after_display_sha256=revision["afterDisplaySha256"],
                   spacing_edits="0", paragraph_edits="0", content_corrections=str(len(corrections)),
                   validation="user_rule_restoration;historical_baseline;immutable_fields;text_consistency", notes=revision["notes"])
    for course, manifest in manifests.items(): write(ROOT / "public" / course / "manifest.json", manifest)
    cli.write_ledger(rows)
    print(f"Restored {report['changed']} articles; examined all {len(plans)}.")


def check():
    report = load(REPORT_PATH)
    report_sha = digest(REPORT_PATH)
    cli = cli_module(); rows = cli.read_ledger()
    if report["policy"] != POLICY or report["scope"] != 1054 or len(report["articles"]) != 1054:
        raise ValueError("Incomplete cleanup inventory")
    if {a["path"] for a in report["articles"]} != {r["path"] for r in rows}:
        raise ValueError("Cleanup coverage differs from live inventory")
    for audit in report["articles"]:
        detail = load(ROOT / audit["path"])
        previous = load(review.REVIEW_ROOT / "history" / f"{audit['originRevisionSha256']}.json")
        if review.canonical_hash(previous) != audit["originRevisionSha256"]: raise ValueError("Cleanup baseline hash mismatch")
        # The before-display is needed for deterministic retention of old spacing.
        before = restore_display(detail, previous["display"])
        payload, expected_audit = clean_display(previous, before)
        if payload != review.display_payload(detail) or audit["afterDisplaySha256"] != review.display_hash(detail):
            raise ValueError(f"Cleanup output changed: {audit['path']}")
        for key in ("actions", "legacyCorrections", "oldestRevisionSha256", "revisionsExamined", "baselineDiscontinuities"):
            if audit[key] != expected_audit[key]: raise ValueError("Cleanup decisions changed")
        if audit["changed"]:
            revision = load(review.revision_path(audit["course"], audit["articleId"]))
            if revision.get("ruleRestoration", {}).get("reportSha256") != report_sha:
                raise ValueError("Cleanup proof no longer matches signed revision")
    print(f"Verified deterministic cleanup of 1054 articles ({report['changed']} changed); no new full-read claim.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("preview", "apply", "check")); args = parser.parse_args()
    if args.action == "check" or REPORT_PATH.exists():
        check(); return
    cli, rows, plans = prepare()
    counts = Counter(a["action"] for p in plans for a in p[5]["actions"])
    print(json.dumps({"scope": len(plans), "changed": sum(p[5]["changed"] for p in plans), "actions": dict(counts)}))
    if args.action == "apply": apply(cli, rows, plans)
    else: write(ROOT / "tmp/article-cleanup/preview.json", {"articles": [p[5] for p in plans]})


if __name__ == "__main__": main()
