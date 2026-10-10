"""Explicit download of the pinned revision; never runs as part of a build."""
import json
import time
from urllib.parse import quote
from urllib.request import Request, urlopen
from english_vocabulary import BOOKS, COMMIT, REPOSITORY, SOURCE, known_issues, parse_entries, sha256, source_path


def download(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={"User-Agent": "WordTap-vocabulary-import"}), timeout=90) as response:
                return response.read()
        except OSError:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def main():
    raw = SOURCE / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((SOURCE / "source-manifest.json").read_text(encoding="utf-8"))
    if manifest["commit"] != COMMIT or manifest["repository"] != REPOSITORY:
        raise ValueError("Source manifest does not match the pinned repository and commit")
    expected = {item["groupId"]: item for item in manifest["files"]}
    if set(expected) != {group for group, _ in BOOKS} or len(expected) != len(manifest["files"]):
        raise ValueError("Missing, duplicate or unexpected source manifest entries")
    errors = []
    for group_id, title in BOOKS:
        path = source_path(title)
        url = f"https://raw.githubusercontent.com/KyleBing/english-vocabulary/{COMMIT}/{quote(path)}"
        data = download(url)
        entries = [json.loads(line) for line in data.decode("utf-8").splitlines()]
        try:
            parse_entries(data, title, known_issues())
        except ValueError as error:
            errors.append(str(error))
        actual = dict(groupId=group_id, path=path, url=url, bytes=len(data), sha256=sha256(data), entryCount=len(entries))
        if actual != expected[group_id]:
            raise ValueError(f"Downloaded source differs from pinned manifest: {title}")
        (raw / f"{title}.jsonl").write_bytes(data)
        print(f"{title}: {len(entries)}", flush=True)
    license_data = download(f"https://raw.githubusercontent.com/KyleBing/english-vocabulary/{COMMIT}/LICENSE")
    if sha256(license_data) != manifest["licenseSha256"] or license_data != (SOURCE / "LICENSE").read_bytes():
        raise ValueError("Downloaded license differs from the pinned license")
    # Fetch populates only ignored raw inputs. Never rewrite release evidence or
    # its formatting: CI checks that fetching and generation leave Git clean.
    if errors:
        raise ValueError("Source validation failed (raw files retained):\n" + "\n".join(errors))


if __name__ == "__main__":
    main()
