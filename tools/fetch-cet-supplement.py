#!/usr/bin/env python3
"""Fetch the registered public CET supplement PDFs into content/cet/raw."""

from __future__ import annotations

import json
import shutil
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "content" / "cet" / "raw" / "wehuster"
REPORT = ROOT / "content" / "cet" / "fetch-report.json"
BASE_URL = "https://www.wehuster.com/static/{level}/{name}"
PAPERS = (
    [(level, 2020, 9, set_no) for level in ("cet4", "cet6") for set_no in (1, 2, 3)]
    + [(level, year, month, set_no) for level in ("cet4", "cet6") for year, month in ((2022, 9), (2023, 3)) for set_no in (1, 2)]
    + [(level, year, month, set_no) for level in ("cet4", "cet6") for year in (2024, 2025) for month in (6, 12) for set_no in (1, 2, 3)]
)


def is_pdf(path: Path) -> bool:
    return path.is_file() and path.stat().st_size > 4 and path.read_bytes()[:5] == b"%PDF-"


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records = []
    for level, year, month, set_no in PAPERS:
        name = f"{level}_{year}_{month:02d}_{set_no}.pdf"
        url = BASE_URL.format(level=level, name=name)
        destination = OUTPUT / name
        status = "retained" if is_pdf(destination) else "downloaded"
        error = ""
        if status == "downloaded":
            temporary = destination.with_suffix(".pdf.part")
            request = urllib.request.Request(url, headers={"User-Agent": "WordTap course importer/1.0"})
            try:
                with urllib.request.urlopen(request, timeout=90) as response, temporary.open("wb") as stream:
                    shutil.copyfileobj(response, stream)
                if not is_pdf(temporary):
                    raise ValueError("response is not a PDF")
                temporary.replace(destination)
            except (OSError, ValueError, urllib.error.URLError) as exc:
                temporary.unlink(missing_ok=True)
                status = "failed"
                error = str(exc)
        records.append({"name": name, "url": url, "status": status, **({"error": error} if error else {})})
        print(f"{status:10} {name}")
    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "sourcePageCet4": "https://www.wehuster.com/cet4",
        "sourcePageCet6": "https://www.wehuster.com/cet6",
        "records": records,
    }
    REPORT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    failed = sum(record["status"] == "failed" for record in records)
    print(f"Checked {len(records)} CET supplement URLs; {failed} failed.")


if __name__ == "__main__":
    main()
