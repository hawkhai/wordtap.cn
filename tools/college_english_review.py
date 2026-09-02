#!/usr/bin/env python3
"""Shared validation helpers for College English manual review."""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path
from typing import Any

from college_english_catalog import ROOT


CONTENT = ROOT / "content" / "College-English"
CATALOG_PATH = CONTENT / "article-catalog.json"
LEDGER_PATH = CONTENT / "manual-review-ledger.tsv"
EVENTS_PATH = CONTENT / "manual-review-events.jsonl"
REVIEWED_ROOT = CONTENT / "reviewed-articles"


def canonical_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def payload_sha256(payload: dict[str, Any]) -> str:
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


def text_sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_catalog() -> dict[str, Any]:
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def load_ledger() -> tuple[list[str], list[dict[str, str]]]:
    with LEDGER_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        return list(reader.fieldnames or []), list(reader)


def write_ledger(fields: list[str], rows: list[dict[str, str]]) -> None:
    with LEDGER_PATH.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, delimiter="\t", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def load_events() -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    previous = ""
    if not EVENTS_PATH.is_file():
        return events
    for line_no, raw in enumerate(EVENTS_PATH.read_text(encoding="utf-8").splitlines(), start=1):
        if not raw.strip():
            continue
        event = json.loads(raw)
        event_hash = event.get("eventSha256", "")
        unsigned = {key: value for key, value in event.items() if key != "eventSha256"}
        if event.get("previousEventSha256", "") != previous:
            raise RuntimeError(f"Review event line {line_no}: broken previous-event hash")
        if payload_sha256(unsigned) != event_hash:
            raise RuntimeError(f"Review event line {line_no}: invalid event hash")
        previous = event_hash
        events.append(event)
    return events


def reviewed_article(article_id: str) -> tuple[dict[str, Any], str, str]:
    path = REVIEWED_ROOT / f"{article_id}.json"
    if not path.is_file():
        raise RuntimeError(f"{article_id}: reviewed article JSON is missing")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("schemaVersion") != 1 or payload.get("id") != article_id:
        raise RuntimeError(f"{article_id}: reviewed article identity is invalid")
    if not isinstance(payload.get("printedPageStart"), int) or not isinstance(payload.get("printedPageEnd"), int):
        raise RuntimeError(f"{article_id}: reviewed article page boundary is missing")
    if payload["printedPageEnd"] < payload["printedPageStart"]:
        raise RuntimeError(f"{article_id}: reviewed article page boundary is invalid")
    paragraphs = payload.get("paragraphs")
    if not isinstance(paragraphs, list) or not paragraphs:
        raise RuntimeError(f"{article_id}: reviewed paragraphs are missing")
    if not all(isinstance(value, str) and value.strip() for value in paragraphs):
        raise RuntimeError(f"{article_id}: reviewed article contains an empty paragraph")
    text = "\n".join(paragraphs)
    if "text" in payload and payload.get("text") != text:
        raise RuntimeError(f"{article_id}: reviewed text does not match paragraphs")
    return payload, text, text_sha256(text)


def passed_prefix(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    passed: list[dict[str, str]] = []
    encountered_unpassed = False
    for row in rows:
        if row["status"] == "passed":
            if encountered_unpassed:
                raise RuntimeError(f"{row['baselineId']}: passed rows must form a continuous prefix")
            passed.append(row)
        else:
            encountered_unpassed = True
    return passed


def validate_passed_rows(rows: list[dict[str, str]], events: list[dict[str, Any]]) -> list[dict[str, str]]:
    passed = passed_prefix(rows)
    events_by_id: dict[str, list[dict[str, Any]]] = {}
    for event in events:
        events_by_id.setdefault(event["articleId"], []).append(event)
    for row in passed:
        article_id = row["baselineId"]
        _, _, final_hash = reviewed_article(article_id)
        pass_events = [
            event for event in events_by_id.get(article_id, [])
            if event.get("toStatus") == "passed"
        ]
        if len(pass_events) != 1:
            raise RuntimeError(f"{article_id}: expected exactly one passing event")
        event = pass_events[0]
        if event.get("reviewer") != row["reviewer"] or not row["reviewer"]:
            raise RuntimeError(f"{article_id}: passing reviewer mismatch")
        if event.get("reviewedAt") != row["reviewedAt"] or not row["reviewedAt"]:
            raise RuntimeError(f"{article_id}: passing timestamp mismatch")
        if event.get("evidence") != row["evidence"] or not row["evidence"]:
            raise RuntimeError(f"{article_id}: passing evidence mismatch")
        if event.get("afterTextSha256") != final_hash or row["textSha256"] != final_hash:
            raise RuntimeError(f"{article_id}: passing text hash mismatch")
        if event.get("eventSha256") != row["eventSha256"]:
            raise RuntimeError(f"{article_id}: passing event hash mismatch")
        if event.get("fullReadConfirmed") is not True:
            raise RuntimeError(f"{article_id}: full-read confirmation is missing")
        if event.get("sourcePages", {}).get("printed") != [
            int(row["printedPageStart"]), int(row["printedPageEnd"])
        ]:
            raise RuntimeError(f"{article_id}: passing page boundary mismatch")
        if row["risk"] == "critical":
            raise RuntimeError(f"{article_id}: critical OCR risk cannot be passed")
    return passed
