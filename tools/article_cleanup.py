"""Deterministic rollback of editorial additions; not a new human source review.

The oldest signed display is the fallback. Only small transcription repairs
with explicit source-comparison evidence survive; editorial claims do not.
"""
from __future__ import annotations

import copy
import difflib
import json
import re
import hashlib
from functools import lru_cache
from pathlib import Path

from article_review import REVIEW_ROOT, canonical_hash, display_payload, without_spacing

POLICY = "source-fidelity-rules-v1"
REPORT = "content/article-review/cleanup-2026-10-06.json"
# Fail closed: generic editorial/source-file references are insufficient.
EDITORIAL = re.compile(r"编辑|校勘|自编|改写|语义|泛化|过时|史实|事实|科学|无来源|未经|幽默|阅读提示|编者|学习版|原(?:文|版|书|教材|讲义|PDF).{0,12}(?:错误|笔误|不准确)|答案.*(?:改|修)|替换.*(?:题|干扰)", re.I)
TRANSCRIPTION = re.compile(r"OCR|录入|识别|漏字|漏行|漏掉|遗漏|漏印|乱码|误识|误读|漏译|原图|页图|页面图|印刷|原文.{0,12}(?:为|是|写|显示)|PDF.{0,25}(?:明确|可见|显示)|LRC.{0,80}(?:漏字|原文)", re.I)
SOURCE_LOCATOR = re.compile(r"PDF|原图|页图|页面图|印刷|原文|LRC|\.jpg|\.png|\.pdf|\.lrc", re.I)
LEGACY_SHUIMU_SHA = "ca2f06de2cec5af68ecf66e6768e41357407ed1dfbb300381b7f7c210e8c68a3"


@lru_cache(maxsize=1)
def legacy_shuimu_edits():
    from article_review import ROOT
    raw = (ROOT / "tools/shuimu-reviewed-corrections.json").read_bytes()
    if hashlib.sha256(raw).hexdigest() != LEGACY_SHUIMU_SHA:
        archived = REVIEW_ROOT / "source-history" / LEGACY_SHUIMU_SHA
        raw = archived.read_bytes()
        if hashlib.sha256(raw).hexdigest() != LEGACY_SHUIMU_SHA: raise ValueError("Legacy correction snapshot changed")
    return json.loads(raw)


def restore_legacy_shuimu(payload, article_id):
    actions = []
    def portable(line):
        return line.translate(str.maketrans({"\uf02e": "•", "\uf06c": "•", "\uf0a1": "◦", "\uf06e": "▪", "\uf0a8": "▫", "\uf075": "▶", "\uf0d8": "➢", "\uf0b2": "◆"})).replace("… …", "……").replace("．", ".")
    for edit in reversed(legacy_shuimu_edits().get(article_id, [])):
        before_lines, after_lines = [[portable(line) for line in edit[key]] for key in ("before", "after")]
        before, after = "\n".join(before_lines), "\n".join(after_lines)
        if without_spacing(before) == without_spacing(after): continue
        blocks = payload["blocks"]
        matches = []
        for start in range(len(blocks)):
            for end in range(start + 1, min(len(blocks), start + len(edit["after"]) + 4) + 1):
                if without_spacing("\n".join(b["text"] for b in blocks[start:end])) == without_spacing(after):
                    matches.append((start, end))
        if len(matches) == 1:
            start, end = matches[0]
            replacement = [{**blocks[start], "text": line} for line in before_lines if line.strip()]
            blocks[start:end] = replacement
            payload["text"] = "\n".join(b["text"] for b in blocks)
        actions.append({"before": before, "after": after, "action": "restore_before_edit" if len(matches) == 1 else "not_present_in_oldest_baseline"})
    return actions


@lru_cache(maxsize=8)
def _report_index(path: str, size: int, modified: int, digest: str) -> dict:
    raw = Path(path).read_bytes()
    if hashlib.sha256(raw).hexdigest() != digest: raise ValueError("Restoration report hash mismatch")
    report = json.loads(raw)
    if report.get("policy") != POLICY or report.get("scope") != 1054 or len(report.get("articles", [])) != 1054:
        raise ValueError("Invalid restoration report scope")
    index = {(a["course"], a["articleId"]): a for a in report["articles"]}
    if len(index) != 1054: raise ValueError("Duplicate restoration article")
    return index


def restoration_evidence(record: dict, course: str, article_id: str) -> dict:
    from article_review import ROOT
    proof = record.get("ruleRestoration", {})
    if proof.get("policy") != POLICY or proof.get("report") != REPORT:
        raise ValueError("Missing explicit rule restoration evidence")
    file = ROOT / REPORT; stat = file.stat()
    evidence = _report_index(str(file), stat.st_size, stat.st_mtime_ns, proof["reportSha256"])[course, article_id]
    if not evidence["changed"]: raise ValueError("Unchanged article cannot receive a restoration revision")
    return evidence


def is_verified_restoration(event: dict) -> bool:
    if not event.get("ruleRestoration"): return False
    evidence = restoration_evidence(event, "college-english", event["articleId"])
    if (event.get("eventType") != "revision" or event.get("fullReadConfirmed") is not False
            or event["afterTextSha256"] != evidence["afterTextSha256"]
            or event["beforeTextSha256"] != evidence["beforeSignedTextSha256"]):
        raise ValueError("College restoration does not match recorded rollback")
    return True


def read_chain(latest: dict, history: Path | None = None) -> list[dict]:
    history = history or REVIEW_ROOT / "history"
    chain, seen = [latest], {canonical_hash(latest)}
    while chain[-1].get("previousRevisionSha256"):
        current = chain[-1]; digest = current["previousRevisionSha256"]
        if digest in seen or not re.fullmatch(r"[a-f0-9]{64}", digest):
            raise ValueError("Invalid cleanup revision chain")
        previous = json.loads((history / f"{digest}.json").read_text(encoding="utf-8"))
        if (canonical_hash(previous) != digest
                or previous["course"] != current["course"] or previous["articleId"] != current["articleId"]):
            raise ValueError("Cleanup history identity/hash mismatch")
        chain.append(previous); seen.add(digest)
    return list(reversed(chain))


def repair_allowed(correction: dict) -> bool:
    before, after = correction.get("before"), correction.get("after")
    if not isinstance(before, str) or not isinstance(after, str) or not before or not after:
        return False
    if without_spacing(before) == without_spacing(after):
        return True
    evidence = correction.get("evidence", "")
    if EDITORIAL.search(evidence) or not SOURCE_LOCATOR.search(evidence) or not TRANSCRIPTION.search(evidence):
        return False
    # Paragraph rewrites and explanations are never admitted as "OCR" repairs.
    if max(len(before), len(after)) > 160 or abs(len(before) - len(after)) > 45:
        return False
    a, b = without_spacing(before), without_spacing(after)
    changed = sum(max(j-i, l-k) for tag, i, j, k, l in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes() if tag != "equal")
    return changed <= 45


def replace_unique(value: str, before: str, after: str) -> str | None:
    if value.count(before) == 1:
        return value.replace(before, after, 1)
    # Display spacing has already been normalized in some historical revisions.
    compact = without_spacing(before)
    if not compact:
        return None
    positions = [i for i, c in enumerate(value) if not c.isspace()]
    normalized = "".join(value[i] for i in positions)
    if normalized.count(compact) != 1:
        return None
    start = normalized.index(compact); end = start + len(compact)
    return value[:positions[start]] + after + value[positions[end-1]+1:]


def apply_repair(payload: dict, correction: dict) -> bool:
    field = correction.get("field", "text")
    before, after = correction["before"], correction["after"]
    if field == "sentences":
        index, lang = correction.get("index"), correction.get("language")
        if type(index) is not int or lang not in {"en", "zh"} or not 0 <= index < len(payload.get("sentences", [])):
            return False
        target = payload["sentences"][index]
        value = replace_unique(target.get(lang, ""), before, after)
        if value is None: return False
        target[lang] = value
        return True
    if not isinstance(payload.get(field), str): return False
    value = replace_unique(payload[field], before, after)
    if value is None: return False
    if field == "text" and "blocks" in payload:
        matching = [(i, replace_unique(b["text"], before, after)) for i, b in enumerate(payload["blocks"])]
        matching = [(i, text) for i, text in matching if text is not None]
        if len(matching) != 1: return False
        i, text = matching[0]; payload["blocks"][i]["text"] = text
    if "sentences" in payload and field in {"text", "bodyText", "bodyTextZh", "question", "questionZh", "title", "titleZh"}:
        language = "zh" if field.endswith("Zh") else "en"
        matching = [(i, replace_unique(s.get(language, ""), before, after)) for i, s in enumerate(payload["sentences"])]
        matching = [(i, text) for i, text in matching if text is not None]
        if len(matching) != 1: return False
        i, text = matching[0]; payload["sentences"][i][language] = text
    payload[field] = value
    return True


def clean_display(latest: dict, detail: dict, history: Path | None = None) -> tuple[dict, dict]:
    chain = read_chain(latest, history)
    result = copy.deepcopy(chain[0]["baselineDisplay"])
    legacy = restore_legacy_shuimu(result, latest["articleId"]) if latest["course"] == "shuimu" else []
    actions = []
    for revision in chain:
        for correction in revision.get("corrections", []):
            trial = copy.deepcopy(result)
            allowed = repair_allowed(correction)
            kept = allowed and apply_repair(trial, correction)
            if kept: result = trial
            actions.append({"revisionSha256": canonical_hash(revision), "correction": correction,
                            "action": "keep_source_transcription" if kept else "restore_before_edit",
                            "reason": "explicit_small_source_repair" if kept else ("ambiguous_or_dependent_match" if allowed else "editorial_or_unproven")})
    # This old generator bug was documented outside the corrections array.
    # Both the PDF comparison and the checked-in regression test establish angrily.
    if latest["course"] == "shuimu" and latest["articleId"] == "beginner-028":
        repair = {"field": "text", "before": "angirly", "after": "angrily", "evidence": "Existing beginner-028 revision notes: PDF第153页确认 angrily，TXT本身也是 angrily；生成器子串替换误造 angirly。"}
        if apply_repair(result, repair):
            actions.append({"revisionSha256": canonical_hash(latest), "correction": repair, "action": "keep_source_transcription", "reason": "documented_generator_bug"})
    # Keep existing layout only when its letters/punctuation are unchanged.
    current = display_payload(detail)
    for key, value in list(result.items()):
        if isinstance(value, str) and isinstance(current.get(key), str) and without_spacing(value) == without_spacing(current[key]):
            result[key] = current[key]
    if "blocks" in result:
        if without_spacing(result["text"]) == without_spacing(current.get("text", "")):
            result["blocks"] = copy.deepcopy(current["blocks"])
        else:
            for block in result["blocks"]:
                matches = [b for b in current.get("blocks", []) if without_spacing(b["text"]) == without_spacing(block["text"])]
                if len(matches) == 1:
                    block["text"] = matches[0]["text"]
                    block["type"] = matches[0].get("type", block.get("type", "paragraph"))
        result["text"] = "\n".join(b["text"] for b in result["blocks"])
    if "sentences" in result:
        if len(result["sentences"]) != len(detail["sentences"]):
            raise ValueError("Cleanup cannot change subtitle coordinates")
        for sentence, existing in zip(result["sentences"], current["sentences"]):
            for language in ("en", "zh"):
                if without_spacing(sentence[language]) == without_spacing(existing[language]):
                    sentence[language] = existing[language]
        for key, lang in (("bodyText", "en"), ("bodyTextZh", "zh")):
            result[key] = "\n".join(s[lang] for s, metadata in zip(result["sentences"], detail["sentences"]) if metadata["role"] == "body").strip()
        for key, lang in (("question", "en"), ("questionZh", "zh")):
            sentences = [s[lang] for s, metadata in zip(result["sentences"], detail["sentences"]) if metadata["role"] == "question"]
            if len(sentences) == 1: result[key] = sentences[0]
        result["text"] = (result["question"] + "\n\n" + result["bodyText"]).strip()
        for key in ("text", "bodyText", "bodyTextZh", "question", "questionZh"):
            if without_spacing(result[key]) == without_spacing(current.get(key, "")):
                result[key] = current[key]
    audit = {"policy": POLICY, "originRevisionSha256": canonical_hash(latest),
             "oldestRevisionSha256": canonical_hash(chain[0]), "revisionsExamined": len(chain),
             "baselineDiscontinuities": [canonical_hash(b) for a, b in zip(chain, chain[1:]) if a["afterDisplaySha256"] != b["beforeDisplaySha256"]],
             "legacyCorrections": legacy, "actions": actions}
    return result, audit


def restore_display(detail: dict, payload: dict) -> dict:
    after = copy.deepcopy(detail)
    for key, value in payload.items():
        if key == "sentences":
            for sentence, text in zip(after[key], value): sentence.update(text)
        else: after[key] = copy.deepcopy(value)
    if "characterCount" in after: after["characterCount"] = len(after["text"])
    if "paragraphCount" in after: after["paragraphCount"] = len(after.get("blocks", []))
    return after


def reversal_corrections(before: dict, after: dict) -> list[dict]:
    from article_review import DISPLAY_KEYS
    corrections = []
    for key in DISPLAY_KEYS:
        if isinstance(before.get(key), str) and without_spacing(before[key]) != without_spacing(after.get(key, "")):
            corrections.append({"field": key, "before": before[key], "after": after[key], "evidence": f"User-directed source-fidelity restoration; {REPORT}"})
    for index, (a, b) in enumerate(zip(before.get("sentences", []), after.get("sentences", []))):
        if a["role"] != "body":
            for language in ("en", "zh"):
                if without_spacing(a[language]) != without_spacing(b[language]):
                    corrections.append({"field": "sentences", "index": index, "language": language,
                                        "before": a[language], "after": b[language], "evidence": f"Historical subtitle restoration; {REPORT}"})
    return corrections
