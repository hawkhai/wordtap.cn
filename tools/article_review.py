"""Source-backed article review: candidates are never approvals.

Generators replay only explicitly recorded revisions, guarded by the complete
display-payload hash. Source provenance, IDs and audio timing stay untouched.
"""
from __future__ import annotations

import copy
import difflib
import hashlib
import json
import re
from pathlib import Path
from functools import lru_cache
from review_archive import evidence_bytes, evidence_exists, evidence_json

ROOT = Path(__file__).resolve().parents[1]
REVIEW_ROOT = ROOT / "content" / "article-review"
COURSES = ("shuimu", "postgraduate", "nce", "pep-english", "college-english", "cet", "kaoyan-english")
DISPLAY_KEYS = ("title", "titleZh", "question", "questionZh", "theme", "author", "unitTitle", "textLabel", "section", "text", "bodyText", "bodyTextZh", "blocks", "sentences")
HAN = r"\u3400-\u9fff\U00020000-\U000323af"
PROTECTED = re.compile(
    r"https?://[^\s<>\u3400-\u9fff]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}"
    r"|(?<![\w.])(?:[A-Za-z0-9-]+\.)+(?:com|org|net|edu|cn|gov|io)(?:/[^\s\u3400-\u9fff]*)?"
    r"|(?<!\w)(?:[A-Za-z]\.){2,}[A-Za-z]?"
    r"|\[[^\]\n]*\]|(?<!\d)\d+(?:\.\d+)+|\d{1,2}:\d{2}(?::\d{2})?"
)


def checked_output_root(output: Path, course: str) -> Path:
    """Resolve and constrain generator replacement targets before deletion."""
    resolved = output.resolve()
    expected = (ROOT / "public" / course).resolve()
    temporary_root = (ROOT / "tmp").resolve()
    if resolved != expected and not resolved.is_relative_to(temporary_root):
        raise ValueError("Generator output must be its public course directory or a workspace tmp subdirectory")
    if resolved == temporary_root:
        raise ValueError("Use a dedicated tmp subdirectory, not tmp itself")
    return resolved


def canonical_hash(value: object) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


@lru_cache(maxsize=2048)
def _file_hash(path: str, size: int, modified: int) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def verify_source(source: dict, *, historical: bool = False) -> None:
    path = Path(source["path"])
    if not path.is_absolute(): path = ROOT / path
    if historical:
        # Superseded signed College sources are retained byte-for-byte by hash.
        archived = REVIEW_ROOT / "source-history" / source["sha256"]
        if archived.is_file():
            if hashlib.sha256(archived.read_bytes()).hexdigest() != source["sha256"]:
                raise ValueError("Historical source snapshot hash mismatch")
            return
    if not path.is_file():
        if not evidence_exists(path): raise ValueError(f"Review source missing: {path}")
        if hashlib.sha256(evidence_bytes(path)).hexdigest() != source["sha256"]:
            raise ValueError("Archived review source changed")
        return
    stat = path.stat()
    if _file_hash(str(path.resolve()), stat.st_size, stat.st_mtime_ns) != source["sha256"]:
        raise ValueError(f"Review source changed: {path}")


def display_payload(detail: dict) -> dict:
    result = {key: copy.deepcopy(detail[key]) for key in DISPLAY_KEYS if key in detail}
    # Sentence coordinates and block metadata are immutable, not display edits.
    if "sentences" in result:
        result["sentences"] = [{key: item[key] for key in ("en", "zh") if key in item} for item in detail["sentences"]]
    return result


def display_hash(detail: dict) -> str:
    return canonical_hash(display_payload(detail))


def normalize_spacing(value: str) -> str:
    """Conservative candidate only; ambiguous OCR/English joins need review."""
    matches = list(PROTECTED.finditer(value))
    protected = [m.group() for m in matches]
    parts, start = [], 0
    for index, match in enumerate(matches):
        leading = " " if match.start() and re.fullmatch(fr"[{HAN}]", value[match.start() - 1]) else ""
        trailing = " " if match.end() < len(value) and re.fullmatch(fr"[{HAN}]", value[match.end()]) else ""
        parts.extend((value[start:match.start()], leading + f"\ue000{index}\ue001" + trailing))
        start = match.end()
    parts.append(value[start:])
    text = "".join(parts)
    text = re.sub(fr"([{HAN}])(?=[A-Za-z0-9])|([A-Za-z0-9])(?=[{HAN}])", r"\1\2 ", text)
    text = re.sub(r"(?<=\S)[ \t]{2,}(?=\S)", " ", text)
    text = re.sub(r"[ \t]+(?=[,.;:!?])", "", text)
    text = re.sub(fr"(?<=[A-Za-z)\]])([,;:!?])(?=[A-Za-z{HAN}])", r"\1 ", text)
    # A Chinese gloss following an English full stop is not an abbreviation's
    # internal dot. English letter-dot-letter is deliberately left for review.
    text = re.sub(fr"(?<=[A-Za-z])(\.)(?=[{HAN}])", r"\1 ", text)
    text = re.sub(r"\([ \t]+", "(", text)
    text = re.sub(r"[ \t]+\)", ")", text)
    for index, original in enumerate(protected):
        text = text.replace(f"\ue000{index}\ue001", original)
    # Keep phonetic contents and decimal/time contents exact; only their outer
    # Chinese boundaries and word-to-IPA boundaries acquire separation.
    text = re.sub(fr"(\])(?=[{HAN}])", r"\1 ", text)
    text = re.sub(r"(?<=[A-Za-z])(?=\[)", " ", text)
    text = re.sub(fr"([{HAN}])(?=\d)", r"\1 ", text)
    text = re.sub(fr"(?<=\d)([{HAN}])", r" \1", text)
    return text


def candidate(detail: dict) -> dict:
    output = copy.deepcopy(detail)
    for key in DISPLAY_KEYS:
        if key in output and isinstance(output[key], str) and key != "text":
            output[key] = normalize_spacing(output[key])
    if "blocks" in output:
        for block in output["blocks"]:
            block["text"] = normalize_spacing(block["text"])
        output["text"] = "\n".join(block["text"] for block in output["blocks"])
    elif "sentences" in output:
        for sentence in output["sentences"]:
            for key in ("en", "zh"):
                sentence[key] = normalize_spacing(sentence[key])
        output["text"] = normalize_spacing(output["text"])
    else:
        output["text"] = normalize_spacing(output["text"])
    if "characterCount" in output:
        output["characterCount"] = len(output["text"])
    return output


def whitespace_only(before: str, after: str) -> bool:
    return re.sub(r"\s", "", before) == re.sub(r"\s", "", after)


def spacing_edits(before: dict, after: dict) -> int:
    # Count primary display fields once, rather than counting text/blocks twice.
    fields = ["title", "titleZh", "question", "questionZh", "theme", "author", "unitTitle", "textLabel", "section"]
    if "sentences" in before:
        pairs = [(a[k], b[k]) for a, b in zip(before["sentences"], after["sentences"]) for k in ("en", "zh")]
    else:
        pairs = [(before.get("text", ""), after.get("text", ""))]
    pairs.extend((before.get(k, ""), after.get(k, "")) for k in fields)
    count = 0
    for a, b in pairs:
        for tag, i, j, k, l in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
            removed, inserted = a[i:j], b[k:l]
            if (tag != "equal" and whitespace_only(removed, inserted)
                    and re.search(r"[ \t]", removed + inserted)):
                count += 1
    return count


def validate_change(before: dict, after: dict, corrections: list[dict] | None = None) -> None:
    for key in set(before) | set(after):
        if key not in DISPLAY_KEYS and key != "characterCount" and before.get(key) != after.get(key):
            raise ValueError(f"Immutable field changed: {key}")
    if "blocks" in after:
        if not after["blocks"] or any(not isinstance(b.get("text"), str) or not b["text"].strip() for b in after["blocks"]):
            raise ValueError("Empty or invalid block")
        if after["text"] != "\n".join(b["text"] for b in after["blocks"]):
            raise ValueError("text/blocks mismatch")
        metadata = lambda blocks: [{k: v for k, v in b.items() if k not in ("text", "type", "lang")} for b in blocks]
        original_metadata = metadata(before.get("blocks", []))
        if any(original_metadata) and original_metadata != metadata(after["blocks"]):
            raise ValueError("Block identity/source/timing changed")
    if "sentences" in after:
        if len(before["sentences"]) != len(after["sentences"]):
            raise ValueError("Sentence count changed")
        for a, b in zip(before["sentences"], after["sentences"]):
            if {k: v for k, v in a.items() if k not in ("en", "zh")} != {k: v for k, v in b.items() if k not in ("en", "zh")}:
                raise ValueError("Sentence timing/role/index changed")
        for field, language in (("bodyText", "en"), ("bodyTextZh", "zh")):
            expected = "\n".join(s[language] for s in after["sentences"] if s["role"] == "body").strip()
            if not whitespace_only(expected, after[field]):
                raise ValueError(f"{field}/sentences mismatch")
        if not whitespace_only(after["text"], after["question"] + "\n" + after["bodyText"]):
            raise ValueError("NCE question/body/text mismatch")
    if "characterCount" in after and after["characterCount"] != len(after["text"]):
        raise ValueError("characterCount mismatch")
    baseline = copy.deepcopy(before)
    for correction in corrections or []:
        if not correction.get("evidence") or not correction.get("before") or "after" not in correction:
            raise ValueError("Content correction requires before/after/evidence")
        field = correction.get("field", "text")
        if field == "sentences":
            index, language = correction.get("index"), correction.get("language")
            sentences = baseline.get("sentences", [])
            if type(index) is not int or not 0 <= index < len(sentences) or language not in ("en", "zh"):
                raise ValueError("Sentence correction requires a valid index and language")
            sentence = sentences[index]
            if sentence.get("role") == "body" or sentence.get(language) != correction["before"]:
                raise ValueError("Sentence correction requires exact non-body text")
            sentence[language] = correction["after"]
            continue
        if field not in DISPLAY_KEYS or not isinstance(baseline.get(field), str):
            raise ValueError("Correction must identify a displayed string field")
        if baseline[field].count(correction["before"]) != 1:
            raise ValueError("Source correction must identify exactly one text occurrence")
        baseline[field] = baseline[field].replace(correction["before"], correction["after"], 1)
    if not whitespace_only(baseline.get("text", ""), after.get("text", "")):
        raise ValueError("Unexplained non-whitespace body change")
    for key in DISPLAY_KEYS:
        if key in ("text", "blocks", "sentences"):
            continue
        if isinstance(baseline.get(key), str) and not whitespace_only(baseline[key], after.get(key, "")):
            raise ValueError(f"Unexplained content change: {key}")
    if "sentences" in after:
        for language, field in (("en", "bodyText"), ("zh", "bodyTextZh")):
            original = "\n".join(s[language] for s in before["sentences"] if s["role"] == "body").strip()
            if not whitespace_only(original, before[field]):
                raise ValueError(f"Original {field}/sentences mismatch")
        # Non-body subtitles need evidence for their own role and language.
        # A question correction must not authorize an unrelated prompt edit.
        for index, (original, revised) in enumerate(zip(before["sentences"], after["sentences"])):
            if original["role"] != "body":
                for language in ("en", "zh"):
                    if whitespace_only(baseline["sentences"][index][language], revised[language]):
                        continue
                    prefix = {"question": "question", "title": "title"}.get(original["role"])
                    field = prefix + ("Zh" if language == "zh" else "") if prefix else None
                    if not field or not whitespace_only(original[language], before.get(field, "")) or not whitespace_only(baseline.get(field, ""), revised[language]):
                        raise ValueError(f"Unexplained {original['role']} sentence change: {language}")


def revision_path(course: str, article_id: str) -> Path:
    if course not in COURSES or not re.fullmatch(r"[A-Za-z0-9_-]+", article_id):
        raise ValueError("Invalid course/article ID")
    return REVIEW_ROOT / "revisions" / course / f"{article_id}.json"


def without_spacing(value: object) -> object:
    if isinstance(value, str):
        return re.sub(r"\s", "", value)
    if isinstance(value, list):
        return [without_spacing(v) for v in value]
    if isinstance(value, dict):
        return {k: without_spacing(v) for k, v in value.items()}
    return value


def generator_baseline_path(course: str, article_id: str) -> Path:
    revision_path(course, article_id)  # Validate identity before constructing a path.
    return REVIEW_ROOT / "generator-baselines" / course / f"{article_id}.json"


def validate_generator_baseline(generated: dict, published: dict, type_changes: list | None = None) -> None:
    """Allow only whitespace plus individually evidenced block type differences."""
    compared = copy.deepcopy(generated)
    seen = set()
    for change in type_changes or []:
        index = change.get("index")
        if (type(index) is not int or index < 0 or index >= len(compared.get("blocks", []))
                or index in seen or not str(change.get("evidence", "")).strip()
                or change.get("before") == change.get("after")
                or change.get("before") not in {"paragraph", "heading", "subheading", "list"}
                or change.get("after") not in {"paragraph", "heading", "subheading", "list"}
                or compared["blocks"][index].get("type") != change.get("before")):
            raise ValueError("Invalid reviewed generator block type difference")
        seen.add(index)
        compared["blocks"][index]["type"] = change["after"]
    if without_spacing(compared) != without_spacing(published):
        raise ValueError("Generator baseline differs in content/structure; source review required")


def register_generator_baseline(detail: dict, course: str, source: Path, locator: str, *, type_changes: list | None = None) -> None:
    """Explicitly reviewed whitespace divergence between generator and public.

    This is an exact additional precondition, never a fuzzy runtime fallback.
    """
    revision = json.loads(revision_path(course, detail["id"]).read_text(encoding="utf-8"))
    baseline = display_payload(detail)
    validate_generator_baseline(baseline, revision["baselineDisplay"], type_changes)
    if display_hash(detail) == revision["beforeDisplaySha256"]:
        return
    proof = {"schemaVersion": 1, "articleId": detail["id"], "course": course,
        "publicBeforeDisplaySha256": revision["beforeDisplaySha256"],
        "generatorBeforeDisplaySha256": display_hash(detail), "display": baseline,
        "source": {"path": str(source), "sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "locator": locator},
        "notes": "Compared generator and existing public baseline; differences are whitespace only; content and block metadata are identical."}
    if type_changes:
        proof["blockTypeChanges"] = copy.deepcopy(type_changes)
        proof["notes"] = "Reviewed whitespace and explicitly listed block type differences; all other content, structure and metadata are identical."
    proof["proofSha256"] = canonical_hash(proof)
    path = generator_baseline_path(course, detail["id"])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def apply_revision(detail: dict, course: str) -> dict:
    file = revision_path(course, detail["id"])
    if not file.is_file():
        return detail
    revision = json.loads(file.read_text(encoding="utf-8"))
    return _apply_revision_record(detail, course, revision, set())


def find_baseline_revision(revision: dict, before_hash: str) -> dict:
    """Locate a generator proof's baseline in the signed, continuous history."""
    seen = set()
    while revision["beforeDisplaySha256"] != before_hash:
        previous_hash = revision.get("previousRevisionSha256", "")
        if not re.fullmatch(r"[0-9a-f]{64}", previous_hash) or previous_hash in seen:
            raise ValueError("Generator proof baseline is not in revision history")
        seen.add(previous_hash)
        file = REVIEW_ROOT / "history" / f"{previous_hash}.json"
        if not evidence_exists(file):
            raise ValueError("Missing generator proof historical baseline")
        previous = evidence_json(file)
        if (canonical_hash(previous) != previous_hash
                or previous.get("course") != revision.get("course")
                or previous.get("articleId") != revision.get("articleId")
                or previous["afterDisplaySha256"] != revision["beforeDisplaySha256"]):
            raise ValueError("Generator proof revision history is invalid")
        revision = previous
    return revision


def _apply_revision_record(detail: dict, course: str, revision: dict, seen: set[str], *, historical: bool = False) -> dict:
    fingerprint = canonical_hash(revision)
    if fingerprint in seen:
        raise ValueError("Cyclic revision history")
    seen = seen | {fingerprint}
    for source in revision.get("sources", []):
        verify_source(source, historical=historical)
    current_hash = display_hash(detail)
    if current_hash == revision["afterDisplaySha256"]:
        return detail
    if current_hash != revision["beforeDisplaySha256"]:
        proof_file = generator_baseline_path(course, detail["id"])
        proof = json.loads(proof_file.read_text(encoding="utf-8")) if proof_file.exists() else {}
        if (proof.get("publicBeforeDisplaySha256") != revision["beforeDisplaySha256"]
                or proof.get("generatorBeforeDisplaySha256") != current_hash
                or proof.get("proofSha256") != canonical_hash({k: v for k, v in proof.items() if k != "proofSha256"})):
            previous_hash = revision.get("previousRevisionSha256", "")
            if not re.fullmatch(r"[0-9a-f]{64}", previous_hash):
                raise ValueError(f"{course}/{detail['id']}: reviewed source changed; re-review required")
            history_file = REVIEW_ROOT / "history" / f"{previous_hash}.json"
            if not evidence_exists(history_file):
                raise ValueError("Missing historical revision")
            historical_record = evidence_json(history_file)
            if canonical_hash(historical_record) != previous_hash or historical_record.get("course") != course or historical_record.get("articleId") != detail["id"]:
                raise ValueError("Historical revision identity/hash mismatch")
            detail = _apply_revision_record(detail, course, historical_record, seen, historical=True)
            if display_hash(detail) != revision["beforeDisplaySha256"]:
                raise ValueError("Historical output does not match next revision baseline")
        else:
            verify_source(proof["source"])
            if proof.get("display") != display_payload(detail):
                raise ValueError("Generator baseline proof payload mismatch")
            validate_generator_baseline(proof["display"], revision["baselineDisplay"], proof.get("blockTypeChanges"))
            baseline = copy.deepcopy(detail)
            for key, value in revision["baselineDisplay"].items():
                if key == "sentences":
                    for sentence, display in zip(baseline[key], value):
                        sentence.update(display)
                else:
                    baseline[key] = copy.deepcopy(value)
            if "characterCount" in baseline:
                baseline["characterCount"] = len(baseline["text"])
            validate_change(detail, baseline)
            detail = baseline
    after = copy.deepcopy(detail)
    for key, value in revision["display"].items():
        if key == "sentences":
            for sentence, display in zip(after[key], value):
                sentence.update(display)
        else:
            after[key] = copy.deepcopy(value)
    if "characterCount" in after:
        after["characterCount"] = len(after["text"])
    validate_change(detail, after, revision.get("corrections", []))
    if display_hash(after) != revision["afterDisplaySha256"]:
        raise ValueError("Invalid revision output hash")
    return after


def sync_summary(summary: dict, detail: dict) -> None:
    for key in DISPLAY_KEYS + ("characterCount",):
        if key in summary and key in detail and key not in ("text", "blocks", "sentences"):
            summary[key] = detail[key]
    if "paragraphCount" in summary:
        summary["paragraphCount"] = len(detail["blocks"])
