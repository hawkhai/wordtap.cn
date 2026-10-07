import copy
import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import article_review as review
import segmentation_review as segmentation


def article(lines):
    return {"id": "example", "title": "Original title", "text": "\n".join(lines),
            "blocks": [{"type": "paragraph", "text": line} for line in lines]}


def decision(before):
    return {"reviewMode": segmentation.MODE, "expectedFileSha256": review.canonical_hash(before),
            "useSpacingCandidate": False, "fullReadConfirmed": True, "recheckConfirmed": True,
            "coverage": "All body blocks, title and surrounding context", "notes": "Read and compared boundaries"}


class SegmentationReviewTests(unittest.TestCase):
    def test_publishing_retry_finishes_manifest_ledger_and_event_once(self):
        spec = importlib.util.spec_from_file_location("publish_retry_test", Path(__file__).with_name("review-articles.py"))
        cli = importlib.util.module_from_spec(spec); spec.loader.exec_module(cli)
        before = article(["An unfinished", "sentence."])
        before.update(jsonPath="shuimu/lessons/example.json", characterCount=len(before["text"]))
        after = article(["An unfinished sentence."])
        after.update(jsonPath=before["jsonPath"], characterCount=len(after["text"]))
        relative = "public/shuimu/lessons/example.json"
        revision = {"status": "passed_edited", "sources": [], "corrections": [], "issues": [],
                    "notes": "Reviewed", "reviewedAt": "test", "beforeDisplaySha256": review.display_hash(before),
                    "afterDisplaySha256": review.display_hash(after)}
        rows = [{k: "" for k in cli.COLUMNS}]
        rows[0].update(path=relative, course="shuimu", id="example", sequence="1")
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            root = Path(directory); lesson = root / relative; lesson.parent.mkdir(parents=True)
            lesson.write_text(json.dumps(before), encoding="utf-8")
            manifest = root / "public/shuimu/manifest.json"
            manifest.write_text(json.dumps({"lessons": [{"jsonPath": before["jsonPath"], "characterCount": before["characterCount"]}]}), encoding="utf-8")
            events = root / "events.jsonl"
            with patch.object(cli, "ROOT", root), patch.object(cli, "EVENTS", events), patch.object(cli, "read_ledger", return_value=rows), patch.object(cli, "write_ledger") as save:
                atomic = cli.write_json_atomic
                def fail_manifest(path, value):
                    if path == manifest: raise OSError("transient manifest write failure")
                    atomic(path, value)
                with patch.object(cli, "write_json_atomic", side_effect=fail_manifest), self.assertRaises(OSError):
                    cli.publish_record(relative, before, after, revision, 1)
                self.assertEqual(json.loads(lesson.read_text(encoding="utf-8")), after)
                self.assertFalse(events.exists())
                cli.publish_record(relative, before, after, revision, 1)
                event_bytes = events.read_bytes()
                cli.publish_record(relative, before, after, revision, 1)
                self.assertEqual(events.read_bytes(), event_bytes)
                self.assertEqual(len(event_bytes.splitlines()), 1)
                self.assertEqual(rows[0]["status"], "passed_edited")
                self.assertEqual(json.loads(manifest.read_text(encoding="utf-8"))["lessons"][0]["characterCount"], len(after["text"]))
                self.assertEqual(save.call_count, 2)

    def test_cross_page_range_can_be_resegmented_without_reordering(self):
        before = article(["A paragraph. Next", "sentence.\nA. First choice", "B. Second choice"])
        after = article(["A paragraph. Next sentence.", "A. First choice", "B. Second choice"])
        choice = decision(before)
        operation = {"index": 0, "end": 2, "before": [b["text"] for b in before["blocks"]],
                     "blocks": after["blocks"], "reason": "Exact cross-page continuation and separate options"}
        choice["splitBlocks"] = [operation]
        spec = importlib.util.spec_from_file_location("range_cli_test", Path(__file__).with_name("review-articles.py"))
        cli = importlib.util.module_from_spec(spec); spec.loader.exec_module(cli)
        self.assertEqual(cli.split_display_block(before["blocks"][0], operation, before["blocks"]), after["blocks"])
        revision = {"reviewMode": segmentation.MODE, "corrections": [],
                    "fullReadConfirmed": True, "recheckConfirmed": True,
                    "baselineDisplay": review.display_payload(before), "display": review.display_payload(after),
                    "beforeDisplaySha256": review.display_hash(before), "afterDisplaySha256": review.display_hash(after),
                    "segmentationReview": {"beforeFileSha256": review.canonical_hash(before),
                                           "afterFileSha256": review.canonical_hash(after), "decision": choice}}
        self.assertEqual(segmentation.before_snapshot(after, revision), before)
        for end in (0, 3):
            bad = copy.deepcopy(revision)
            bad["segmentationReview"]["decision"]["splitBlocks"][0]["end"] = end
            with self.assertRaises(ValueError): segmentation.validate_revision(bad)
        bad = copy.deepcopy(revision)
        bad["segmentationReview"]["decision"]["splitBlocks"].append(operation)
        with self.assertRaises(ValueError): segmentation.validate_revision(bad)

    def test_inventory_is_pending_until_read_and_changed_json_invalidates_review(self):
        spec = importlib.util.spec_from_file_location("segmentation_cli_test", Path(__file__).with_name("review-segmentation.py"))
        cli = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cli)
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            root = Path(directory)
            inventory = []
            for course, count in cli.COURSE_COUNTS.items():
                for index in range(count):
                    relative = f"public/{course}/lessons/{index:03d}.json"
                    path = root / relative
                    path.parent.mkdir(parents=True, exist_ok=True)
                    detail = article(["An unfinished", "sentence."])
                    detail["id"] = str(index)
                    path.write_text(json.dumps(detail), encoding="utf-8")
                    inventory.append(dict(sequence=str(len(inventory) + 1), path=relative,
                                          course=course, id=str(index), title=detail["title"]))
            ledger_dir = root / "review"
            with patch.multiple(cli, ROOT=root, DIRECTORY=ledger_dir, LEDGER=ledger_dir / "ledger.tsv"), \
                    patch.object(cli, "article_cli", return_value=Mock(read_ledger=lambda: inventory)):
                cli.initialize()
                rows = cli.rows()
                self.assertEqual(len(rows), 1054)
                self.assertTrue(all(r["status"] == "pending" and r["full_read_confirmed"] == "false" for r in rows))
                self.assertTrue(all(int(r["candidate_count"]) > 0 for r in rows))
                cli.check()
                with self.assertRaisesRegex(ValueError, "incomplete"):
                    cli.check(require_complete=True)
                first = rows[0]
                first.update(status="passed_unchanged", full_read_confirmed="true", recheck_confirmed="true",
                             reviewed_at="2026-01-01", after_file_sha256=first["before_file_sha256"])
                cli.save(rows)
                path = root / first["path"]
                changed = json.loads(path.read_text(encoding="utf-8"))
                changed["text"] += " "
                changed["blocks"][-1]["text"] += " "
                path.write_text(json.dumps(changed), encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "JSON changed"):
                    cli.check()
                cli.initialize()
                refreshed = cli.rows()[0]
                self.assertEqual(refreshed["status"], "pending")
                self.assertEqual(refreshed["full_read_confirmed"], "false")
                self.assertEqual(refreshed["reviewed_at"], "")
                cli.check()
                rows = cli.rows()
                rows[-1] = dict(rows[0])
                cli.save(rows)
                with self.assertRaisesRegex(ValueError, "inventory"):
                    cli.check()

    def test_user_example_has_exact_four_blocks_and_registered_full_review(self):
        path = review.ROOT / "public/shuimu/lessons/intermediate/061.json"
        detail = json.loads(path.read_text(encoding="utf-8"))
        expected = [
            "After reading an article entitled ‘Cigarette Smoking and Your Health’ I lit a cigarette to calm my nerves.",
            "读完一篇题为《吸烟与健康》的文章之后，我点上了一枝香烟，来镇定一下自己紧张的神经。",
            "I smoked with concentration and pleasure as I was sure that this would be my last cigarette.",
            "我聚精会神而又愉快地吸着这枝烟。因为我确信这是我最后一枝烟了。",
        ]
        texts = [b["text"] for b in detail["blocks"]]
        start = texts.index(expected[0])
        self.assertEqual(texts[start:start + 4], expected)
        revision = json.loads(review.revision_path("shuimu", detail["id"]).read_text(encoding="utf-8"))
        before = segmentation.before_snapshot(detail, revision)
        self.assertEqual(review.apply_revision(before, "shuimu"), detail)
        self.assertEqual(review.apply_revision(detail, "shuimu"), detail)
        # The entire exercise/option and vocabulary structure retains its anchors.
        segmentation.validate_layout_change(before, detail)
        self.assertTrue(revision["fullReadConfirmed"] and revision["recheckConfirmed"])

    def test_list_continuation_preserves_items_and_dialogue_poetry_lines(self):
        before = article(["A. Dr. Li paid", "3.14. See https://example.com/a.",
                          "B. No payment", "Ann: Why?", "Bob: I agreed.", "Roses are red", "Violets are blue"])
        before["blocks"][0]["type"] = before["blocks"][2]["type"] = "list"
        after = copy.deepcopy(before)
        after["blocks"][0]["text"] += " " + after["blocks"].pop(1)["text"]
        after["text"] = "\n".join(b["text"] for b in after["blocks"])
        segmentation.validate_layout_change(before, after)
        self.assertEqual(after["blocks"][2:], before["blocks"][3:])
        wrong = copy.deepcopy(after)
        wrong["blocks"][0]["text"] += " " + wrong["blocks"].pop(1)["text"]
        wrong["text"] = "\n".join(b["text"] for b in wrong["blocks"])
        with self.assertRaises(ValueError): segmentation.validate_layout_change(before, wrong)

    def test_bilingual_split_preserves_order_and_requires_exact_decision(self):
        before = article(['"First sentence. Second sentence."\n第一句。第二句。'])
        after = article(['"First sentence. Second sentence."', '第一句。第二句。'])
        choice = decision(before)
        choice["splitBlocks"] = [{"index": 0, "before": [before["text"]],
                                  "blocks": after["blocks"], "reason": "English and its complete translation"}]
        revision = {"reviewMode": segmentation.MODE, "corrections": [],
                    "fullReadConfirmed": True, "recheckConfirmed": True,
                    "baselineDisplay": review.display_payload(before), "display": review.display_payload(after),
                    "beforeDisplaySha256": review.display_hash(before), "afterDisplaySha256": review.display_hash(after),
                    "segmentationReview": {"beforeFileSha256": review.canonical_hash(before),
                                           "afterFileSha256": review.canonical_hash(after), "decision": choice}}
        self.assertEqual(segmentation.before_snapshot(after, revision), before)
        tampered = copy.deepcopy(revision)
        tampered["segmentationReview"]["decision"].pop("splitBlocks")
        with self.assertRaises(ValueError): segmentation.validate_revision(tampered)
        tampered = copy.deepcopy(revision)
        tampered["segmentationReview"]["beforeFileSha256"] = "0" * 64
        tampered["segmentationReview"]["decision"]["expectedFileSha256"] = "0" * 64
        with self.assertRaises(ValueError): segmentation.before_snapshot(after, tampered)

    def test_bilingual_line_wraps_and_multi_sentence_paragraph(self):
        before = article(["I lit a cigarette", "to calm my nerves.", "镇定一下自", "己紧张的神经。", "I stopped. Then I left."])
        after = article(["I lit a cigarette to calm my nerves.", "镇定一下自己紧张的神经。", "I stopped. Then I left."])
        segmentation.validate_layout_change(before, after)
        segmentation.validate_layout_change(after, after)

    def test_no_changes_to_words_order_titles_types_or_metadata(self):
        before = article(["First sentence.", "Second sentence."])
        bad = []
        for lines in (["Second sentence.", "First sentence."], ["First corrected sentence.", "Second sentence."]):
            bad.append(article(lines))
        for key, value in (("title", "Changed"), ("id", "changed"), ("audio", "new.mp3")):
            item = copy.deepcopy(before); item[key] = value; bad.append(item)
        item = copy.deepcopy(before); item["blocks"][0]["type"] = "heading"; bad.append(item)
        item = copy.deepcopy(before); item["blocks"][0]["lang"] = "zh"; bad.append(item)
        for after in bad:
            with self.subTest(after=after), self.assertRaises(ValueError):
                segmentation.validate_layout_change(before, after)

    def test_sentence_subtitles_are_exact_while_reading_boundaries_may_change(self):
        before = {"title": "T", "question": "Why?", "text": "Why?\nA sentence.\nAnother one.",
                  "bodyText": "A sentence.\nAnother one.", "bodyTextZh": "一句。\n另一句。",
                  "sentences": [{"en": "A sentence.", "zh": "一句。", "role": "body", "startTime": 1},
                                {"en": "Another one.", "zh": "另一句。", "role": "body", "startTime": 2}]}
        after = copy.deepcopy(before)
        after.update(bodyText="A sentence. Another one.", bodyTextZh="一句。另一句。", text="Why?\n\nA sentence. Another one.")
        segmentation.validate_layout_change(before, after)
        for key, value in (("en", "A sentence. "), ("startTime", 9), ("role", "question")):
            changed = copy.deepcopy(after); changed["sentences"][0][key] = value
            with self.assertRaises(ValueError): segmentation.validate_layout_change(before, changed)

    def test_contextual_decisions_require_current_hash_and_explicit_read(self):
        before = article(["Hello."]); approved = decision(before)
        segmentation.validate_decision(before, approved)
        for key, value in (("expectedFileSha256", "0" * 64), ("fullReadConfirmed", False),
                           ("recheckConfirmed", False), ("useSpacingCandidate", True), ("coverage", ""),
                           ("notes", ["Read all"]), ("coverage", ["All blocks"]),
                           ("issues", [{"location": "block 1", "detail": "Unclear"}]),
                           ("removeBlocks", [{"start": 0}]), ("mergeBlocks", [{"start": 0, "end": 1}])):
            with self.subTest(key=key), self.assertRaises(ValueError):
                segmentation.validate_decision(before, {**approved, key: value})

    def test_scan_keeps_items_bilingual_boundaries_and_punctuation_protected(self):
        before = article(["An unfinished", "sentence.", "English fragment", "对应中文", "Choose", "A. first", "B. second", "Dr. Smith paid 3.14.", "Next paragraph."])
        original = copy.deepcopy(before)
        found = segmentation.candidates(before)
        # The option-to-prose transition remains a candidate, never an auto-merge.
        self.assertEqual([f["start"] for f in found], [0, 6])
        self.assertEqual(before, original)

    def test_frozen_cleanup_requires_signed_continuous_layout_history(self):
        before = article(["First", "sentence."]); after = article(["First sentence."])
        original = {"course": "shuimu", "articleId": "example", "display": review.display_payload(before),
                    "afterDisplaySha256": review.display_hash(before)}
        baseline_hash = review.canonical_hash(original)
        revision = {"course": "shuimu", "articleId": "example", "reviewMode": segmentation.MODE,
                    "corrections": [], "fullReadConfirmed": True, "recheckConfirmed": True,
                    "beforeDisplaySha256": review.display_hash(before), "afterDisplaySha256": review.display_hash(after),
                    "baselineDisplay": review.display_payload(before), "display": review.display_payload(after),
                    "previousRevisionSha256": baseline_hash,
                    "segmentationReview": {"beforeFileSha256": review.canonical_hash(before),
                                           "afterFileSha256": review.canonical_hash(after), "decision": decision(before)}}
        revision["segmentationReview"]["decision"]["mergeBlocks"] = [{"start": 0, "end": 1,
            "before": ["First", "sentence."], "text": "First sentence.", "reason": "Same sentence continues"}]
        with tempfile.TemporaryDirectory() as directory:
            history = Path(directory)
            (history / f"{baseline_hash}.json").write_text(json.dumps(original), encoding="utf-8")
            self.assertEqual(segmentation.validate_advance(revision, review.display_hash(before), after, history), original)
            for key, value in (("reviewMode", "other"), ("previousRevisionSha256", "bad"), ("fullReadConfirmed", False)):
                with self.subTest(key=key), self.assertRaises(ValueError):
                    segmentation.validate_advance({**revision, key: value}, review.display_hash(before), after, history)
            tampered = copy.deepcopy(after); tampered["id"] = "bad"
            with self.assertRaises(ValueError): segmentation.validate_advance(revision, review.display_hash(before), tampered, history)


if __name__ == "__main__":
    unittest.main()
