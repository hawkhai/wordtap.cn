import copy
import hashlib
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

import article_review as review
from review_archive import compact_history, evidence_bytes, evidence_exists, evidence_json


class ReviewArchiveTests(unittest.TestCase):
    def test_compaction_preserves_bytes_is_repeatable_and_accepts_new_history(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); history = root / "history"; history.mkdir()
            value = {"text": "中文\nSecond line."}
            path = history / (review.canonical_hash(value) + ".json")
            raw = (json.dumps(value, ensure_ascii=False, indent=2) + "\r\n").encode()
            path.write_bytes(raw)
            result = compact_history(root)
            self.assertFalse(history.exists())
            self.assertTrue(evidence_exists(path))
            self.assertEqual(evidence_bytes(path), raw)
            self.assertEqual(evidence_json(path), value)
            self.assertEqual(compact_history(root), result)
            review.verify_source({"path": str(path), "sha256": hashlib.sha256(raw).hexdigest()})
            with self.assertRaises(ValueError):
                review.verify_source({"path": str(path), "sha256": "0" * 64})
            history.mkdir(); added = {"text": "New revision"}
            (history / (review.canonical_hash(added) + ".json")).write_text(json.dumps(added), encoding="utf-8")
            self.assertEqual(compact_history(root)["entries"], 2)
            self.assertEqual(evidence_bytes(path), raw)
            missing = history / ("0" * 64 + ".json")
            self.assertFalse(evidence_exists(missing))
            with self.assertRaises(FileNotFoundError): evidence_bytes(missing)

    def test_invalid_content_and_conflicting_loose_bytes_are_not_deleted(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); history = root / "history"; history.mkdir()
            bad = history / ("0" * 64 + ".json"); bad.write_text("{}")
            with self.assertRaises(ValueError): compact_history(root)
            self.assertTrue(bad.exists()); self.assertFalse((root / "history.zip").exists())
            bad.unlink(); value = {"text": "Original"}
            path = history / (review.canonical_hash(value) + ".json")
            path.write_text(json.dumps(value)); compact_history(root)
            history.mkdir(); path.write_text(json.dumps(value, indent=2))
            with self.assertRaises(ValueError): compact_history(root)
            self.assertTrue(path.exists())

    def test_replay_and_generator_baseline_use_packed_history_and_reject_tampering(self):
        before = {"id": "unit-001", "title": "T", "text": "One.\nTwo.",
                  "blocks": [{"type": "paragraph", "text": "One."}, {"type": "paragraph", "text": "Two."}]}
        first = {**before, "text": "One. Two.", "blocks": [{"type": "paragraph", "text": "One. Two."}]}
        latest = {**first, "text": "One.  Two.", "blocks": [{"type": "paragraph", "text": "One.  Two."}]}
        old = {"course": "shuimu", "articleId": before["id"], "beforeDisplaySha256": review.display_hash(before),
               "afterDisplaySha256": review.display_hash(first), "baselineDisplay": review.display_payload(before), "display": review.display_payload(first)}
        digest = review.canonical_hash(old)
        new = {**old, "previousRevisionSha256": digest, "beforeDisplaySha256": review.display_hash(first),
               "afterDisplaySha256": review.display_hash(latest), "baselineDisplay": review.display_payload(first), "display": review.display_payload(latest)}
        with tempfile.TemporaryDirectory() as directory, patch.object(review, "REVIEW_ROOT", Path(directory)):
            root = Path(directory); history = root / "history"; history.mkdir()
            (history / (digest + ".json")).write_text(json.dumps(old), encoding="utf-8")
            file = review.revision_path("shuimu", before["id"]); file.parent.mkdir(parents=True)
            file.write_text(json.dumps(new), encoding="utf-8"); compact_history(root)
            self.assertEqual(review.apply_revision(before, "shuimu"), latest)
            self.assertEqual(review.apply_revision(latest, "shuimu"), latest)
            self.assertEqual(review.find_baseline_revision(new, review.display_hash(before)), old)
            with zipfile.ZipFile(root / "history.zip", "w") as archive:
                archive.writestr(digest + ".json", json.dumps({**old, "articleId": "changed"}))
            with self.assertRaises(ValueError): review.apply_revision(before, "shuimu")


if __name__ == "__main__":
    unittest.main()
