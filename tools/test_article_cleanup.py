import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import article_review as review
import article_cleanup as cleanup


def article(text):
    return {"id": "test-001", "title": "Original title", "text": text,
            "blocks": [{"type": "paragraph", "text": line} for line in text.splitlines()]}


def revision(before, after, corrections=()):
    return {"course": "postgraduate", "articleId": "test-001",
            "beforeDisplaySha256": review.display_hash(before), "afterDisplaySha256": review.display_hash(after),
            "baselineDisplay": review.display_payload(before), "display": review.display_payload(after),
            "corrections": list(corrections)}


class CleanupTests(unittest.TestCase):
    def test_rolls_back_all_history_but_keeps_original_notes(self):
        original = article("编者注：原版已有。\nAn old story.")
        first = article("编者注：原版已有。\n阅读提示：自行解释。\nA rewritten story.")
        latest = article("编者注：原版已有。\n阅读提示：自行解释。\nA rewritten story.\nMore advice.")
        a = revision(original, first); b = revision(first, latest)
        b["previousRevisionSha256"] = review.canonical_hash(a)
        with tempfile.TemporaryDirectory() as directory:
            history = Path(directory)
            (history / f"{review.canonical_hash(a)}.json").write_text(json.dumps(a), encoding="utf-8")
            restored, audit = cleanup.clean_display(b, latest, history)
            self.assertEqual(restored, review.display_payload(original))
            self.assertEqual(audit["revisionsExamined"], 2)
            self.assertNotIn("阅读提示", restored["text"])
            (history / f"{review.canonical_hash(a)}.json").write_text("{}", encoding="utf-8")
            with self.assertRaises(ValueError): cleanup.clean_display(b, latest, history)

    def test_small_explicit_source_repair_survives_but_editorial_claim_does_not(self):
        original = article("Rober is here.\nThe original story.")
        corrected = article("Robert is here.\nA new story.")
        repair = {"before": "Rober", "after": "Robert", "evidence": "PDF第3页可见 Robert，OCR漏字。"}
        rewrite = {"before": "The original story.", "after": "A new story.", "evidence": "编辑校勘，更准确的故事。"}
        restored, audit = cleanup.clean_display(revision(original, corrected, [repair, rewrite]), corrected)
        self.assertEqual(restored["text"], "Robert is here.\nThe original story.")
        self.assertEqual(audit["actions"][0]["action"], "keep_source_transcription")
        self.assertFalse(cleanup.repair_allowed({**repair, "evidence": "原PDF姓名笔误，编辑修正"}))
        self.assertFalse(cleanup.repair_allowed({**repair, "before": "x" * 300}))

    def test_ambiguous_repair_restores_baseline_and_spacing_only_layout_survives(self):
        original = article("Word Word")
        current = article("Word\nWord")
        repair = {"before": "Word", "after": "World", "evidence": "PDF第2页可见 World，OCR漏字"}
        payload, audit = cleanup.clean_display(revision(original, current, [repair]), current)
        self.assertEqual(payload, review.display_payload(current))
        self.assertEqual(audit["actions"][0]["action"], "restore_before_edit")

    def test_original_subtitles_restored_without_changing_timing_or_roles(self):
        original = {"id": "test-001", "title": "T", "question": "Why?", "questionZh": "为何？",
                    "bodyText": "Old.", "bodyTextZh": "原文。", "text": "Why?\n\nOld.",
                    "sentences": [{"en": "Why?", "zh": "为何？", "role": "question", "startTime": 1},
                                  {"en": "Old.", "zh": "原文。", "role": "body", "startTime": 4}]}
        current = copy.deepcopy(original)
        current.update(text="Why?\n\nNew.", bodyText="New.", bodyTextZh="改写。")
        current["sentences"][1].update(en="New.", zh="改写。")
        payload, _ = cleanup.clean_display(revision(original, current), current)
        after = cleanup.restore_display(current, payload)
        self.assertEqual(after, original)
        review.validate_change(current, after, cleanup.reversal_corrections(current, after))

    def test_legacy_grammar_rewrite_is_reversed_without_keyword_deletion(self):
        payload = review.display_payload(article("She is French.\n原版注释。"))
        with patch.object(cleanup, "legacy_shuimu_edits", return_value={"test-001": [{"before": ["She is a French."], "after": ["She is French."]}]}):
            actions = cleanup.restore_legacy_shuimu(payload, "test-001")
        self.assertEqual(payload["text"], "She is a French.\n原版注释。")
        self.assertEqual(actions[0]["action"], "restore_before_edit")

    def test_historical_sources_require_exact_archived_bytes(self):
        import hashlib
        with tempfile.TemporaryDirectory() as directory, patch.object(review, "REVIEW_ROOT", Path(directory)):
            data = b"old signed source"; digest = hashlib.sha256(data).hexdigest()
            source = {"path": str(Path(directory) / "missing"), "sha256": digest}
            target = Path(directory) / "source-history" / digest
            target.parent.mkdir(); target.write_bytes(data)
            review.verify_source(source, historical=True)
            with self.assertRaises(ValueError): review.verify_source(source)
            target.write_bytes(b"tampered")
            with self.assertRaises(ValueError): review.verify_source(source, historical=True)


if __name__ == "__main__": unittest.main()
