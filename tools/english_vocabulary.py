"""Pinned upstream vocabulary ingestion; offline, deterministic publication."""
import hashlib
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "content/english-vocabulary"
PUBLIC = ROOT / "public/english-vocabulary"
COMMIT = "c4c6c80879ff17d7025c28fb853a4991c8e6be6a"
REPOSITORY = "https://github.com/KyleBing/english-vocabulary"
# Published identifiers: never rename/reassign when upstream adds a book.
BOOKS = [
    ("evjunior", "初中"), ("evsenior", "高中"),
    ("evcet4", "四级"), ("evcet6", "六级"), ("evkaoyan", "考研"),
    ("evtoefl", "托福"), ("evsat", "SAT"), ("evielts", "雅思"),
    ("evgre", "GRE"), ("evgmat", "GMAT"), ("evtem4", "专四"),
    ("evtem8", "专八"), ("evbusiness", "商务英语"),
    ("evpep3", "人教小学三年级"), ("evpep4", "人教小学四年级"),
    ("evpep5", "人教小学五年级"), ("evpep6", "人教小学六年级"),
    ("evpep7", "人教初中七年级"), ("evpep8", "人教初中八年级"),
    ("evpep9", "人教初中九年级"), ("evpeph", "人教高中"),
    ("evbnu", "北师高中"), ("evfltrp", "外研社初中"),
]


def source_path(title):
    return f"full_line_jsonl/sentence/正序/{title}.jsonl"


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encoded(value))


def known_issues(source=SOURCE):
    path = source / "known-issues.json"
    if not path.exists():
        return []
    record = json.loads(path.read_text(encoding="utf-8"))
    if record["commit"] != COMMIT:
        raise ValueError("Known issues belong to a different revision")
    return record["issues"]


def validate_strings(value, location, exceptions, seen):
    if location in exceptions:
        if value != exceptions[location]:
            raise ValueError(f"{location}: known issue changed; review required")
        seen.add(location)
        return
    if isinstance(value, str):
        for char in value:
            if char in "\ufeff\ufffd" or unicodedata.category(char) in ("Co", "Cs") or (unicodedata.category(char) == "Cc" and char not in "\n\r\t"):
                raise ValueError(f"{location}: invalid character U+{ord(char):04X}")
    elif isinstance(value, dict):
        for key, item in value.items():
            validate_strings(item, f"{location}.{key}", exceptions, seen)
    elif isinstance(value, list):
        for index, item in enumerate(value):
            validate_strings(item, f"{location}[{index}]", exceptions, seen)


def parse_entries(data, label, issues=()):
    entries = []
    exceptions = {f"{label}:{issue['line']}{issue['field']}": issue["value"] for issue in issues if issue["book"] == label and issue["action"] == "preserve-upstream"}
    seen = set()
    for line_no, line in enumerate(data.decode("utf-8").splitlines(), 1):
        location = f"{label}:{line_no}"
        try:
            entry = json.loads(line)
        except ValueError as error:
            raise ValueError(f"{location}: invalid JSON: {error}") from error
        if not isinstance(entry, dict) or not isinstance(entry.get("word"), str) or not entry["word"].strip():
            raise ValueError(f"{location}: empty or invalid word")
        validate_strings(entry, location, exceptions, seen)
        for key in ("uk", "us"):
            if key in entry and not isinstance(entry[key], str):
                raise ValueError(f"{location}: {key} must be a string")
        for key, required in (("translations", "translation"), ("phrases", "phrase"), ("sentences", "sentence")):
            if key not in entry:
                continue
            if not isinstance(entry[key], list):
                raise ValueError(f"{location}: {key} must be an array")
            for index, item in enumerate(entry[key]):
                allowed_empty = f"{location}.{key}[{index}].{required}" in seen
                if not isinstance(item, dict) or not isinstance(item.get(required), str) or (not item[required].strip() and not allowed_empty):
                    raise ValueError(f"{location}: invalid {key} entry")
                if any(not isinstance(v, str) for v in item.values()):
                    raise ValueError(f"{location}: invalid {key} value")
        entries.append(entry)
    if not entries:
        raise ValueError(f"{label}: empty source")
    if seen != set(exceptions):
        raise ValueError(f"{label}: stale known issue references")
    return entries


def reading_entry(entry):
    lines = [entry["word"]]
    phonetics = [f"{label} /{entry[key].strip().strip('/')}/" for key, label in (("uk", "英"), ("us", "美")) if entry.get(key, "").strip()]
    if phonetics:
        lines.append("音标：" + "  ".join(phonetics))
    for item in entry.get("translations", []):
        kind = item.get("type", "").strip()
        lines.append((kind.rstrip(".") + ". " if kind else "") + item["translation"])
    for item in entry.get("phrases", []):
        lines.append("短语：" + item["phrase"] + (" — " + item["translation"] if item.get("translation") else ""))
    for item in entry.get("sentences", []):
        if item["sentence"]:
            lines.append("例句：" + item["sentence"])
        if item.get("translation"):
            lines.append(item["translation"])
    return "\n".join(lines)


def typing_text(entries):
    # Keep one source example (or headword) per paragraph; no synthetic examples.
    parts = []
    for entry in entries:
        sentences = [item["sentence"] for item in entry.get("sentences", []) if re.search("[A-Za-z]", item["sentence"])]
        parts.extend(sentences or [entry["word"]])
    return "\n\n".join(parts)


def artifacts(source=SOURCE):
    record = json.loads((source / "source-manifest.json").read_text(encoding="utf-8"))
    if record["commit"] != COMMIT or len(record["files"]) != len(BOOKS):
        raise ValueError("Unexpected upstream revision or source count")
    if sha256((source / "LICENSE").read_bytes()) != record["licenseSha256"]:
        raise ValueError("Source license SHA-256 mismatch")
    groups = []
    outputs = {}
    issues = known_issues(source)
    for group_id, title in BOOKS:
        data = (source / "raw" / f"{title}.jsonl").read_bytes()
        provenance = next(item for item in record["files"] if item["path"] == source_path(title))
        if sha256(data) != provenance["sha256"]:
            raise ValueError(f"{title}: source SHA-256 mismatch")
        entries = parse_entries(data, title, issues)
        if len(entries) != provenance["entryCount"]:
            raise ValueError(f"{title}: source count mismatch")
        lessons, index = [], []
        for start in range(0, len(entries), 20):
            batch = entries[start:start + 20]
            unit = start // 20 + 1
            lesson_id = f"{group_id}-{unit:03d}"
            relative = f"lessons/{group_id}/{unit:03d}.json"
            summary = dict(id=lesson_id, groupId=group_id, unitNo=unit,
                           title=f"{batch[0]['word']} — {batch[-1]['word']}", wordCount=len(batch),
                           firstWord=batch[0]["word"], lastWord=batch[-1]["word"],
                           jsonPath=f"english-vocabulary/{relative}")
            text = f"英语词汇 · {title} · 第 {unit} 单元\n\n" + "\n\n".join(map(reading_entry, batch))
            if len(text) > 120000:
                raise ValueError(f"{lesson_id}: exceeds saved text limit")
            outputs[relative] = dict(schemaVersion=1, **summary, groupTitle=title,
                entries=batch, text=text, typingText=typing_text(batch),
                source=dict(commit=COMMIT, path=source_path(title), sha256=provenance["sha256"],
                            lineStart=start + 1, lineEnd=start + len(batch)))
            lessons.append(summary)
            index.append(dict(id=lesson_id, words=[item["word"] for item in batch]))
        outputs[f"indexes/{group_id}.json"] = dict(schemaVersion=1, groupId=group_id, lessons=index)
        groups.append(dict(id=group_id, title=title, wordCount=len(entries), lessonCount=len(lessons),
                           indexPath=f"english-vocabulary/indexes/{group_id}.json", lessons=lessons))
    outputs["manifest.json"] = dict(schemaVersion=1, generatedAt=record["commitDate"], knownIssueCount=len(issues),
        generator="tools/generate-english-vocabulary-data.py", generatorVersion="1",
        source=dict(repository=REPOSITORY, commit=COMMIT, license="BSD-3-Clause"),
        totalWords=sum(group["wordCount"] for group in groups),
        totalLessons=sum(group["lessonCount"] for group in groups), groups=groups)
    return outputs
