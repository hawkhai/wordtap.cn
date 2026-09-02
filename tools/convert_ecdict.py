#!/usr/bin/env python3
"""Convert ECDICT CSV into static JSON shards for WordTap."""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import shutil
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = PROJECT_DIR / "public" / "dict"
DEFAULT_TARGET_SHARD_BYTES = 100_000
DEFAULT_MAX_PREFIX_LENGTH = 16
SAFE_SHARD_CHARS = set("abcdefghijklmnopqrstuvwxyz0123456789 -'")


def clean_text(value: str | None) -> str:
    return (value or "").replace("\\n", "\n").strip()


def normalize_word(word: str) -> str:
    return word.strip().lower()


def shard_name_for_word(word: str) -> str:
    normalized = normalize_word(word)
    if re.match(r"^[a-z]$", normalized):
        return normalized
    match = re.match(r"^[a-z]{2}", normalized)
    if match:
        return normalized[:2]
    return "misc"


def json_size_bytes(data: Any) -> int:
    return len(json.dumps(data, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8"))


def compact_entry(record: dict[str, str]) -> dict[str, str]:
    entry = {
        "word": clean_text(record.get("word")),
        "phonetic": clean_text(record.get("phonetic")),
        "translation": clean_text(record.get("translation")),
        "definition": clean_text(record.get("definition")),
    }
    return {key: value for key, value in entry.items() if value}


def write_json(path: Path, data: Any) -> None:
    path.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":"), sort_keys=True),
        encoding="utf-8",
    )


def shard_file_name(shard_name: str) -> str:
    return f"shard-{shard_name}.json"


def is_safe_shard_char(char: str) -> bool:
    return char in SAFE_SHARD_CHARS


def remove_tree(path: Path, attempts: int = 20) -> None:
    for attempt in range(attempts):
        try:
            shutil.rmtree(path)
            return
        except PermissionError:
            if attempt == attempts - 1:
                raise
            time.sleep(0.25)


def ensure_safe_output_path(output: Path, force: bool) -> Path:
    resolved = output.expanduser().resolve(strict=False)
    default_output = DEFAULT_OUTPUT.resolve(strict=False)
    project_public = (PROJECT_DIR / "public").resolve(strict=False)
    home = Path.home().resolve(strict=False)
    high_risk_paths = {
        PROJECT_DIR.resolve(strict=False),
        project_public,
        home,
        resolved.anchor and Path(resolved.anchor).resolve(strict=False),
    }

    if resolved in high_risk_paths or resolved.parent == resolved:
        raise ValueError(f"Refusing to delete high-risk output path: {resolved}")

    if resolved != default_output and not force:
        raise ValueError(
            "Custom --output requires --force because the converter replaces the output directory."
        )

    if resolved == project_public:
        raise ValueError("Refusing to replace the whole public directory.")

    return resolved


def split_oversized_shard(
    shard_name: str,
    entries: dict[str, dict[str, str]],
    target_bytes: int,
    max_prefix_length: int,
) -> dict[str, dict[str, dict[str, str]]]:
    if json_size_bytes(entries) <= target_bytes:
        return {shard_name: entries}

    if shard_name == "misc" or len(shard_name) >= max_prefix_length:
        return {shard_name: entries}

    current_entries: dict[str, dict[str, str]] = {}
    child_groups: dict[str, dict[str, dict[str, str]]] = defaultdict(dict)
    next_index = len(shard_name)

    for word, entry in entries.items():
        if word.startswith(shard_name) and len(word) > next_index and is_safe_shard_char(word[next_index]):
            child_groups[word[: next_index + 1]][word] = entry
        else:
            current_entries[word] = entry

    if not child_groups:
        return {shard_name: entries}

    result: dict[str, dict[str, dict[str, str]]] = {}
    if current_entries:
        result[shard_name] = current_entries

    for child_name, child_entries in child_groups.items():
        result.update(split_oversized_shard(child_name, child_entries, target_bytes, max_prefix_length))

    return result


def convert(
    source: Path,
    output: Path,
    target_bytes: int,
    max_prefix_length: int,
    force: bool = False,
) -> dict[str, Any]:
    output = ensure_safe_output_path(output, force)
    if not source.exists():
        raise FileNotFoundError(f"ECDICT CSV not found: {source}")

    shards: dict[str, dict[str, dict[str, str]]] = defaultdict(dict)
    skipped = 0
    entry_count = 0

    with source.open("r", encoding="utf-8-sig", newline="") as fp:
        reader = csv.DictReader(fp)
        for record in reader:
            word = normalize_word(record.get("word", ""))
            if not word:
                skipped += 1
                continue

            entry = compact_entry(record)
            if not entry.get("translation") and not entry.get("definition") and not entry.get("phonetic"):
                skipped += 1
                continue

            shards[shard_name_for_word(word)][word] = entry

    final_shards: dict[str, dict[str, dict[str, str]]] = {}
    for shard_name, shard_entries in shards.items():
        final_shards.update(split_oversized_shard(shard_name, shard_entries, target_bytes, max_prefix_length))

    temp_output = output.with_name(f"{output.name}.tmp.{os.getpid()}")
    if temp_output.exists():
        remove_tree(temp_output)
    temp_shards = temp_output / "shards"
    temp_shards.mkdir(parents=True)

    largest_shard = {"name": "", "bytes": 0, "entries": 0}
    oversize_shards = []
    shard_files = {}
    for shard_name in sorted(final_shards):
        shard_entries = final_shards[shard_name]
        entry_count += len(shard_entries)
        file_name = shard_file_name(shard_name)
        shard_files[shard_name] = file_name
        shard_path = temp_shards / file_name
        write_json(shard_path, shard_entries)
        shard_size = shard_path.stat().st_size
        if shard_size > target_bytes:
            oversize_shards.append(
                {
                    "name": shard_name,
                    "bytes": shard_size,
                    "entries": len(shard_entries),
                }
            )
        if shard_size > largest_shard["bytes"]:
            largest_shard = {
                "name": shard_name,
                "bytes": shard_size,
                "entries": len(shard_entries),
            }

    manifest = {
        "version": "ecdict-static-shards-v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": source.name,
        "strategy": "adaptive-prefix-json",
        "fields": ["word", "phonetic", "translation", "definition"],
        "entryCount": entry_count,
        "skippedCount": skipped,
        "shardCount": len(final_shards),
        "targetShardBytes": target_bytes,
        "maxPrefixLength": max_prefix_length,
        "shardNames": sorted(final_shards),
        "shardFiles": shard_files,
        "largestShard": largest_shard,
        "oversizeShards": oversize_shards,
    }
    write_json(temp_output / "manifest.json", manifest)

    if output.exists():
        remove_tree(output)
    shutil.move(str(temp_output), str(output))
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert ECDICT CSV into WordTap dictionary shards.")
    parser.add_argument("--source", type=Path, required=True, help="Path to an authorized ECDICT ecdict.csv")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output dictionary directory")
    parser.add_argument(
        "--target-shard-bytes",
        type=int,
        default=DEFAULT_TARGET_SHARD_BYTES,
        help="Target maximum JSON shard size in bytes",
    )
    parser.add_argument(
        "--max-prefix-length",
        type=int,
        default=DEFAULT_MAX_PREFIX_LENGTH,
        help="Maximum prefix length used when splitting oversized shards",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Allow replacing a custom --output directory after safety checks",
    )
    args = parser.parse_args()

    manifest = convert(args.source, args.output, args.target_shard_bytes, args.max_prefix_length, args.force)
    largest = manifest["largestShard"]
    print(
        "Generated {entryCount} entries in {shardCount} shards at {output}".format(
            output=args.output,
            **manifest,
        )
    )
    print(
        "Largest shard: {name}.json, {entries} entries, {mib:.2f} MiB".format(
            name=largest["name"],
            entries=largest["entries"],
            mib=largest["bytes"] / 1024 / 1024,
        )
    )
    if manifest["oversizeShards"]:
        print(f"Warning: {len(manifest['oversizeShards'])} shards are still above target size")


if __name__ == "__main__":
    main()
