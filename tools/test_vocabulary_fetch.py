import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("vocabulary_fetch", Path(__file__).with_name("fetch-english-vocabulary.py"))
fetch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch)


class VocabularyFetchTests(unittest.TestCase):
    def test_fetch_preserves_tracked_manifest_and_license_and_rejects_drift(self):
        data = b'{"word":"hello"}\n'
        license_data = b'Pinned license\r\n'
        title = "Test"
        source_path = fetch.source_path(title)
        url = f"https://raw.githubusercontent.com/KyleBing/english-vocabulary/{fetch.COMMIT}/{fetch.quote(source_path)}"
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory)
            manifest = {"repository": fetch.REPOSITORY, "commit": fetch.COMMIT, "licenseSha256": fetch.sha256(license_data),
                        "files": [{"groupId": "test", "path": source_path, "url": url, "bytes": len(data),
                                   "sha256": fetch.sha256(data), "entryCount": 1}]}
            manifest_bytes = (json.dumps(manifest, indent=2) + "\r\n").encode()
            (source / "source-manifest.json").write_bytes(manifest_bytes)
            (source / "LICENSE").write_bytes(license_data)
            def download(location):
                return license_data if location.endswith("/LICENSE") else data
            with patch.object(fetch, "SOURCE", source), patch.object(fetch, "BOOKS", [("test", title)]), \
                    patch.object(fetch, "known_issues", return_value=[]), patch.object(fetch, "parse_entries"), \
                    patch.object(fetch, "download", side_effect=download):
                fetch.main()
                self.assertEqual((source / "raw/Test.jsonl").read_bytes(), data)
                self.assertEqual((source / "source-manifest.json").read_bytes(), manifest_bytes)
                self.assertEqual((source / "LICENSE").read_bytes(), license_data)
                with patch.object(fetch, "download", return_value=b'{"word":"changed"}\n'):
                    with self.assertRaisesRegex(ValueError, "differs from pinned manifest"):
                        fetch.main()
                self.assertEqual((source / "raw/Test.jsonl").read_bytes(), data)
                with patch.object(fetch, "download", side_effect=lambda location: b'changed license' if location.endswith('/LICENSE') else data):
                    with self.assertRaisesRegex(ValueError, "license differs"):
                        fetch.main()
                self.assertEqual((source / "LICENSE").read_bytes(), license_data)


if __name__ == "__main__":
    unittest.main()
