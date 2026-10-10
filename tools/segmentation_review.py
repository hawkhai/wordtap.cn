"""JSON-only paragraph review. Candidates never grant review approval."""
from __future__ import annotations

import copy
import json
import re
from pathlib import Path

from article_review import canonical_hash, display_hash, display_payload, validate_change, without_spacing
from review_archive import evidence_json

MODE = "json-segmentation-v1"
COMPLETE = {"passed_unchanged", "passed_edited"}
STATUSES = COMPLETE | {"pending", "in_review", "edited_pending_recheck", "needs_confirmation"}


def validate_layout_change(before: dict, after: dict) -> None:
    """Only body whitespace/boundaries may change; all other fields stay exact."""
    validate_change(before, after)
    allowed = {"text", "bodyText", "bodyTextZh", "blocks", "characterCount"}
    if {k: v for k, v in before.items() if k not in allowed} != {k: v for k, v in after.items() if k not in allowed}:
        raise ValueError("Segmentation changed immutable fields or subtitles")
    for key in ("text", "bodyText", "bodyTextZh"):
        if without_spacing(before.get(key)) != without_spacing(after.get(key)):
            raise ValueError(f"Segmentation changed non-whitespace text: {key}")
    # Preserve language/identity metadata across merges. A list item's wrapped
    # continuation may have been misclassified as a paragraph by the importer.
    def block_runs(detail):
        runs = []
        for block in detail.get("blocks", []):
            metadata = {k: v for k, v in block.items() if k not in ("text", "type")}
            text = without_spacing(block["text"])
            if runs and runs[-1][0] == metadata:
                runs[-1][1] += text
            else:
                runs.append([metadata, text])
        return runs
    if block_runs(before) != block_runs(after):
        raise ValueError("Segmentation changed block language or metadata")
    def structural_anchors(detail):
        offset = 0
        anchors = []
        for block in detail.get("blocks", []):
            if block.get("type") != "paragraph":
                anchors.append((offset, block.get("type")))
            offset += len(without_spacing(block["text"]))
        return anchors
    if structural_anchors(before) != structural_anchors(after):
        raise ValueError("Segmentation changed heading/list boundaries")


def validate_evidence_fields(decision: dict) -> None:
    if any(not isinstance(decision.get(key), str) or not decision[key].strip() for key in ("notes", "coverage")):
        raise ValueError("Full-text coverage and contextual review notes must be nonempty strings")
    issues = decision.get("issues", [])
    if not isinstance(issues, list) or any(not isinstance(issue, str) or not issue.strip() for issue in issues):
        raise ValueError("Review issues must be a list of explanatory strings")


def validate_decision(before: dict, decision: dict) -> None:
    validate_evidence_fields(decision)
    if decision.get("expectedFileSha256") != canonical_hash(before):
        raise ValueError("Stale JSON review decision")
    if decision.get("useSpacingCandidate") is not False:
        raise ValueError("Segmentation must disable spacing candidates")
    if decision.get("fullReadConfirmed") is not True or decision.get("recheckConfirmed") is not True:
        raise ValueError("Full read and recheck must be explicitly confirmed")
    if not decision.get("notes") or not decision.get("coverage"):
        raise ValueError("Full-text coverage and contextual review notes required")
    if any(decision.get(k) for k in ("corrections", "removeBlocks", "prependBlocks")):
        raise ValueError("Segmentation only accepts merge/split operations and body whitespace")
    for edit in decision.get("blockEdits", []):
        if set(edit) != {"index", "before", "text", "reason"} or not edit["reason"]:
            raise ValueError("Block whitespace edit requires exact text and reason, no type changes")
        if without_spacing(edit["before"]) != without_spacing(edit["text"]):
            raise ValueError("Block edit changed non-whitespace characters")
    if set(decision.get("display", {})) - {"text", "bodyText", "bodyTextZh"}:
        raise ValueError("Only reading body fields may be replaced")
    for op in decision.get("mergeBlocks", []) + decision.get("splitBlocks", []):
        if not op.get("reason"):
            raise ValueError("Each boundary decision requires a contextual reason")


def validate_revision(revision: dict) -> None:
    if revision.get("reviewMode") != MODE or revision.get("corrections"):
        raise ValueError("Unregistered layout revision")
    proof = revision.get("segmentationReview", {})
    decision = proof.get("decision", {})
    validate_evidence_fields(decision)
    if (decision.get("reviewMode") != MODE or decision.get("expectedFileSha256") != proof.get("beforeFileSha256")
            or not re.fullmatch(r"[a-f0-9]{64}", proof.get("afterFileSha256", ""))
            or decision.get("useSpacingCandidate") is not False
            or decision.get("fullReadConfirmed") is not True or decision.get("recheckConfirmed") is not True
            or not decision.get("notes") or not decision.get("coverage")
            or revision.get("fullReadConfirmed") is not True or revision.get("recheckConfirmed") is not True):
        raise ValueError("Incomplete JSON layout review proof")
    a, b = revision["baselineDisplay"], revision["display"]
    if canonical_hash(a) != revision["beforeDisplaySha256"] or canonical_hash(b) != revision["afterDisplaySha256"]:
        raise ValueError("Layout revision display hash mismatch")
    # Payload sentences omit timing/roles, so validate those by exact equality here.
    if a.get("sentences") != b.get("sentences"):
        raise ValueError("Layout revision changed subtitles")
    aa, bb = copy.deepcopy(a), copy.deepcopy(b)
    aa.pop("sentences", None); bb.pop("sentences", None)
    validate_layout_change(aa, bb)
    # Reproduce the exact authored operations; a whitespace-only diff is not approval.
    expected = copy.deepcopy(a)
    expected.update(copy.deepcopy(decision.get("display", {})))
    for edit in decision.get("blockEdits", []):
        block = expected["blocks"][edit["index"]]
        if (set(edit) != {"index", "before", "text", "reason"} or not edit["reason"]
                or block["text"] != edit["before"] or without_spacing(edit["before"]) != without_spacing(edit["text"])):
            raise ValueError("Block whitespace edit precondition mismatch")
        block["text"] = edit["text"]
    operations = decision.get("mergeBlocks", []) + [dict(op, start=op["index"], end=op.get("end", op["index"]), split=True) for op in decision.get("splitBlocks", [])]
    ranges = sorted((op["start"], op["end"]) for op in operations)
    if (any(start < 0 or end < start or end >= len(a.get("blocks", [])) for start, end in ranges)
            or any(left[1] >= right[0] for left, right in zip(ranges, ranges[1:]))):
        raise ValueError("Invalid layout operation ranges")
    for op in sorted(operations, key=lambda item: item["start"], reverse=True):
        run = expected["blocks"][op["start"]:op["end"] + 1]
        if not op.get("reason") or [block["text"] for block in run] != op["before"]:
            raise ValueError("Layout operation precondition/reason mismatch")
        replacement = ([{**run[0], **piece} for piece in op["blocks"]] if op.get("split") else [{**run[0], "text": op["text"]}])
        expected["blocks"][op["start"]:op["end"] + 1] = replacement
    if "blocks" in expected:
        expected["text"] = "\n".join(block["text"] for block in expected["blocks"])
    if expected != b:
        raise ValueError("Layout output does not match explicitly recorded operations")


def validate_advance(latest: dict, baseline_hash: str, detail: dict, history: Path) -> dict:
    """Walk only recorded JSON layout revisions back to the frozen cleanup output."""
    current = latest
    seen = set()
    snapshot = copy.deepcopy(detail)
    while current["afterDisplaySha256"] != baseline_hash or current.get("reviewMode") == MODE:
        digest = canonical_hash(current)
        if digest in seen:
            raise ValueError("Cyclic layout history")
        seen.add(digest)
        validate_revision(current)
        if (current["afterDisplaySha256"] != display_hash(snapshot)
                or current["segmentationReview"]["afterFileSha256"] != canonical_hash(snapshot)):
            raise ValueError("Published JSON differs from registered layout review")
        snapshot = before_snapshot(snapshot, current)
        previous_hash = current.get("previousRevisionSha256", "")
        if not re.fullmatch(r"[a-f0-9]{64}", previous_hash):
            raise ValueError("Missing layout baseline revision")
        previous = evidence_json(history / f"{previous_hash}.json")
        if (canonical_hash(previous) != previous_hash or previous.get("course") != current.get("course")
                or previous.get("articleId") != current.get("articleId")
                or previous["afterDisplaySha256"] != current["beforeDisplaySha256"]
                or previous["display"] != current["baselineDisplay"]):
            raise ValueError("Discontinuous layout revision history")
        current = previous
    return current


def before_snapshot(after: dict, revision: dict) -> dict:
    """Restore a reviewed input from JSON evidence, retaining immutable metadata."""
    validate_revision(revision)
    if canonical_hash(after) != revision["segmentationReview"]["afterFileSha256"]:
        raise ValueError("Snapshot output hash mismatch")
    before = copy.deepcopy(after)
    for key, value in revision["baselineDisplay"].items():
        if key == "sentences":
            for sentence, display in zip(before[key], value):
                sentence.update(display)
        else:
            before[key] = copy.deepcopy(value)
    if "characterCount" in before:
        before["characterCount"] = len(before["text"])
    if canonical_hash(before) != revision["segmentationReview"]["beforeFileSha256"]:
        raise ValueError("Snapshot input hash mismatch")
    validate_decision(before, revision["segmentationReview"]["decision"])
    validate_layout_change(before, after)
    return before


HAN = re.compile(r"[\u3400-\u9fff]")
ITEM = re.compile(r"^(?:\(?[A-Da-d][.)、]|\d+[.)、]|[•◦▪▶]|[A-Z][a-z]+\s*[:：])")
END = re.compile(r"[.!?。！？][\"'’”）)]*$")


def candidates(detail: dict) -> list[dict]:
    """Broad, read-only cues; punctuation alone never authorizes a merge."""
    result = []
    blocks = detail.get("blocks", [])
    for index, (left, right) in enumerate(zip(blocks, blocks[1:])):
        a, b = left["text"].strip(), right["text"].strip()
        if left.get("type") not in {"paragraph", "list"} or right.get("type") != "paragraph":
            continue
        if not a or not b or ITEM.match(b) or bool(HAN.search(a)) != bool(HAN.search(b)):
            continue
        if not END.search(a):
            result.append({"field": "blocks", "start": index, "end": index + 1,
                           "before": [a, b], "reason": "Possible physical line break; inspect context, item/turn and paragraph boundaries"})
    fields = [(f"blocks/{i}/text", b["text"]) for i, b in enumerate(blocks)] if blocks else [(k, detail[k]) for k in ("text", "bodyTextZh") if k in detail]
    for field, value in fields:
        if re.search(r"\S[\t ]*\n[\t ]*\S", value):
            result.append({"field": field, "reason": "Internal line breaks require contextual review"})
    return result
