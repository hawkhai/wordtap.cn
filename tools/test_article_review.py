import copy
import json
import tempfile
import unittest
import importlib.util
from pathlib import Path
from unittest.mock import patch

import article_review as review
import college_english_review as college


class ArticleReviewTests(unittest.TestCase):
    def test_portable_snapshot_checks_evidence_without_reopening_raw_sources(self):
        spec = importlib.util.spec_from_file_location("review_cli", Path(__file__).with_name("review-articles.py"))
        cli = importlib.util.module_from_spec(spec); spec.loader.exec_module(cli)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); evidence = root / "content/article-review"
            lesson = root / "public/shuimu/lessons/001.json"
            lesson.parent.mkdir(parents=True)
            revision_file = evidence / "revisions/shuimu/001.json"
            revision_file.parent.mkdir(parents=True)
            detail = {"id": "001", "title": "Example", "text": "Hello.",
                      "blocks": [{"type": "paragraph", "lang": "en", "text": "Hello."}]}
            digest = review.display_hash(detail)
            revision = {"beforeDisplaySha256": digest, "afterDisplaySha256": digest,
                        "baselineDisplay": review.display_payload(detail), "display": review.display_payload(detail),
                        "sources": [{"path": str(root / "missing.pdf"), "sha256": "0" * 64}]}
            event = {"path": lesson.relative_to(root).as_posix(), "previousEventSha256": "",
                     "revisionSha256": review.canonical_hash(revision)}
            event["eventSha256"] = review.canonical_hash(event)
            lesson.write_text(json.dumps(detail), encoding="utf-8")
            revision_file.write_text(json.dumps(revision), encoding="utf-8")
            events = evidence / "events.jsonl"; events.write_text(json.dumps(event) + "\n", encoding="utf-8")
            row = dict.fromkeys(cli.COLUMNS, "")
            row.update(path=event["path"], course="shuimu", id="001", status="passed_unchanged", after_display_sha256=digest)
            with patch.object(cli, "ROOT", root), patch.object(cli, "REVIEW_ROOT", evidence), \
                    patch.object(cli, "LEDGER", evidence / "ledger.tsv"), patch.object(cli, "EVENTS", events), \
                    patch.object(review, "ROOT", root), patch.object(review, "REVIEW_ROOT", evidence):
                cli.write_ledger([row])
                cli.verify(True, published_only=True)
                with self.assertRaisesRegex(ValueError, "source|Source"):
                    cli.verify(True)
                for file, payload, message in [
                    (lesson, {**detail, "title": "Changed"}, "reviewed content changed"),
                    (revision_file, {**revision, "note": "tampered"}, "evidence changed"),
                    (events, {**event, "eventSha256": "bad"}, "event hash chain"),
                ]:
                    original = file.read_bytes()
                    file.write_text(json.dumps(payload), encoding="utf-8")
                    with self.subTest(file=file), self.assertRaisesRegex(ValueError, message):
                        cli.verify(True, published_only=True)
                    file.write_bytes(original)
                cli.write_ledger([{**row, "status": "pending"}])
                with self.assertRaisesRegex(ValueError, "incomplete"):
                    cli.verify(True, published_only=True)

    def test_generator_type_proof_rejects_unreviewed_content_and_metadata(self):
        generated = {"text": "Answer.\nEssay.", "blocks": [{"type": "paragraph", "lang": "en", "text": "Answer.\nEssay."}]}
        published = copy.deepcopy(generated); published["blocks"][0]["type"] = "heading"
        proof = {"index": 0, "before": "paragraph", "after": "heading", "evidence": "PDF page 11: old heading covered full answer page"}
        with self.assertRaises(ValueError): review.validate_generator_baseline(generated, published)
        review.validate_generator_baseline(generated, published, [proof])
        for changes in ([{**proof, "index": -1}], [{**proof, "evidence": ""}], [proof, proof], [{**proof, "before": "list"}]):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                review.validate_generator_baseline(generated, published, changes)
        for key, value in [("text", "Wrong answer."), ("lang", "zh"), ("startTime", 1)]:
            altered = copy.deepcopy(published); altered["blocks"][0][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                review.validate_generator_baseline(generated, altered, [proof])

    def test_college_restoration_requires_exact_current_signed_display(self):
        row = {'baselineId': 'a', 'eventSha256': 'signed'}
        payload = {'title': 'Letter', 'paragraphs': ['Love,\nFather']}
        detail = {'id': 'a', 'title': 'Letter', 'text': 'Love,\nFather',
                  'blocks': [{'type': 'paragraph', 'lang': 'en', 'text': 'Love,\nFather'}],
                  'manualReview': {'eventSha256': 'signed', 'textSha256': 'digest'}}
        with patch.object(college, 'load_ledger', return_value=([], [row])), \
                patch.object(college, 'load_events', return_value=[]), \
                patch.object(college, 'validate_passed_rows', return_value=[row]), \
                patch.object(college, 'reviewed_article', return_value=(payload, 'Love,\nFather', 'digest')):
            college.validate_signed_display(detail)
            for key, value in [('text', 'Love, Father'), ('title', 'Changed'), ('blocks', []),
                               ('manualReview', {'eventSha256': 'old', 'textSha256': 'digest'})]:
                with self.subTest(key=key), self.assertRaises(ValueError):
                    college.validate_signed_display({**detail, key: value})

    def test_nce_alternate_title_does_not_consume_listening_question(self):
        spec = importlib.util.spec_from_file_location("nce_generator", review.ROOT / "scripts/generate_nce_json.py")
        generator = importlib.util.module_from_spec(spec); spec.loader.exec_module(generator)
        source = Path(__file__).parent / "fixtures/nce-question"
        entries = json.loads((source / "static/data.json").read_text(encoding="utf-8"))["2"]
        entry = next(item for item in entries if generator.lesson_numbers(item["filename"])[0] == 25)
        _, rows = generator.parse_lrc(source / "NCE2" / (entry["filename"] + ".lrc"))
        with tempfile.TemporaryDirectory() as output, patch.object(generator, "apply_revision", side_effect=lambda detail, course: detail):
            summary, detail = generator.build_lesson(review.ROOT, source, Path(output), generator.BOOKS[1], entry, "test")
        self.assertEqual(detail["question"], "Why does the writer not understand the porter?")
        self.assertTrue(detail["bodyText"].startswith("I arrived in London at last."))
        self.assertEqual([s["role"] for s in detail["sentences"][:5]], ["lesson", "title", "prompt", "question", "body"])
        self.assertEqual(summary["bodySentenceCount"], len(rows) - 4)
        self.assertEqual(len(detail["sentences"]), len(rows))
        for index, (original, generated) in enumerate(zip(rows, detail["sentences"])):
            self.assertEqual(generated["index"], index)
            for key in ("en", "zh", "startTime", "endTime"):
                self.assertEqual(original[key], generated[key])
        for invalid in (rows[:3] + rows[4:], rows + [rows[3]]):
            with self.assertRaises(ValueError):
                generator.locate_question_row(invalid, 1, detail["question"])

    def test_prompt_correction_requires_own_exact_evidence(self):
        before = {"question": "Who?", "questionZh": "谁？", "text": "Who?\nHi.", "bodyText": "Hi.", "bodyTextZh": "你好。", "sentences": [
            {"index": 0, "role": "prompt", "en": "Listen.", "zh": "错误提问", "startTime": 1},
            {"index": 1, "role": "question", "en": "Who?", "zh": "谁？", "startTime": 2},
            {"index": 2, "role": "body", "en": "Hi.", "zh": "你好。", "startTime": 3}]}
        after = copy.deepcopy(before); after["sentences"][0]["zh"] = "请听录音。"
        evidence = {"field": "sentences", "index": 0, "language": "zh", "before": "错误提问", "after": "请听录音。", "evidence": "Checked source prompt"}
        with self.assertRaises(ValueError): review.validate_change(before, after)
        review.validate_change(before, after, [evidence])
        for invalid in ({**evidence, "index": -1}, {**evidence, "index": 1}, {**evidence, "before": "stale"}, {**evidence, "language": "role"}, {**evidence, "evidence": ""}):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError): review.validate_change(before, after, [invalid])
        after["questionZh"] = after["sentences"][1]["zh"] = "哪位？"
        unrelated = {"field": "questionZh", "before": "谁？", "after": "哪位？", "evidence": "Question only"}
        with self.assertRaises(ValueError): review.validate_change(before, after, [unrelated])
        review.validate_change(before, after, [evidence, unrelated])
        after["sentences"][0]["startTime"] = 0
        with self.assertRaises(ValueError): review.validate_change(before, after, [evidence, unrelated])

    def test_source_heading_split_preserves_content_and_rejects_metadata(self):
        spec = importlib.util.spec_from_file_location("review_cli", Path(__file__).with_name("review-articles.py"))
        cli = importlib.util.module_from_spec(spec); spec.loader.exec_module(cli)
        block = {"type": "paragraph", "lang": "en", "text": "Trait 1. Body."}
        operation = {"before": [block["text"]], "blocks": [{"type": "subheading", "text": "Trait 1."}, {"text": "Body."}]}
        pieces = cli.split_display_block(block, operation)
        review.validate_change({"text": block["text"], "blocks": [block]}, {"text": "\n".join(b["text"] for b in pieces), "blocks": pieces})
        for invalid in ({**operation, "before": ["stale"]}, {**operation, "blocks": [{"text": "Trait 1.", "startTime": 0}, {"text": "Body."}]}, {**operation, "blocks": [{"text": "Trait 1."}]}):
            with self.assertRaises(ValueError): cli.split_display_block(block, invalid)
        changed = cli.split_display_block(block, {**operation, "blocks": [{"text": "Trait 1."}, {"text": "Changed."}]})
        with self.assertRaises(ValueError): review.validate_change({"text": block["text"], "blocks": [block]}, {"text": "\n".join(b["text"] for b in changed), "blocks": changed})

    def test_missing_intro_requires_exact_anchor_and_source_evidence(self):
        spec = importlib.util.spec_from_file_location("review_cli", Path(__file__).with_name("review-articles.py"))
        cli = importlib.util.module_from_spec(spec); spec.loader.exec_module(cli)
        before = {"text": "Remaining text.", "blocks": [{"type": "paragraph", "text": "Remaining text."}]}
        prefix = {"before": before["text"], "blocks": [{"type": "subheading", "text": "Missing question?"}]}
        after = copy.deepcopy(before)
        cli.prepend_display_blocks(after, before, prefix)
        after["text"] = "\n".join(b["text"] for b in after["blocks"])
        with self.assertRaises(ValueError): review.validate_change(before, after)
        review.validate_change(before, after, [{"before": before["text"], "after": after["text"], "evidence": "PDF chapter boundary page 3"}])
        for invalid in ({**prefix, "before": "stale"}, {**prefix, "blocks": [{**prefix["blocks"][0], "startTime": 1}]}, {**prefix, "blocks": []}):
            with self.assertRaises(ValueError): cli.prepend_display_blocks(copy.deepcopy(before), before, invalid)

    def test_shuimu_repairs_do_not_change_substrings_of_valid_words(self):
        spec = importlib.util.spec_from_file_location("shuimu_generator", Path(__file__).with_name("generate-shuimu-data.py"))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertEqual(module.correct_line("angrily gril 'gril'"), "angrily girl 'girl'")
        self.assertEqual(module.correct_line("theif, magzines; fiend of mine"), "thief, magazines; friend of mine")

    def test_spacing_preserves_protected_text(self):
        examples = {
            "Jimmy今天是第1课。": "Jimmy 今天是第 1 课。",
            "3M公司": "3M 公司",
            "n.手提包;别见外。": "n. 手提包;别见外。",
            "book[bʊk]书": "book [bʊk] 书",
            "See https://example.org/x?a=1.2 中文": "See https://example.org/x?a=1.2 中文",
            "Email a.b@example.com at 7:00 a.m. with 1.25 and U.S.A.": "Email a.b@example.com at 7:00 a.m. with 1.25 and U.S.A.",
            "• excuse [ɪkˈskju:z] vt. 原谅": "• excuse [ɪkˈskju:z] vt. 原谅",
            "30minutes __26__ profit-driven": "30minutes __26__ profit-driven",
            "Go ( now ) ,please!Today": "Go (now), please! Today",
            "主语 谓语 宾语": "主语 谓语 宾语",
            "3.14元 7:00时": "3.14 元 7:00 时",
            "访问https://example.org/a中文": "访问 https://example.org/a 中文",
            "来自 U.S.A.的书": "来自 U.S.A. 的书",
            "邮箱 test@example.com地址": "邮箱 test@example.com 地址",
            "填空[ A  B ]答案": "填空 [ A  B ] 答案",
        }
        for before, after in examples.items():
            with self.subTest(before=before):
                self.assertEqual(review.normalize_spacing(before), after)
                self.assertEqual(review.normalize_spacing(after), after)

    def test_replay_is_guarded_and_idempotent(self):
        before = {"id": "unit-001", "title": "第1课", "text": "Jimmy今天", "blocks": [{"type": "paragraph", "text": "Jimmy今天"}], "source": {"sha256": "keep"}, "characterCount": 7}
        before["characterCount"] = len(before["text"])
        after = review.candidate(before)
        with tempfile.TemporaryDirectory() as tmp, patch.object(review, "REVIEW_ROOT", Path(tmp)):
            file = review.revision_path("shuimu", before["id"])
            file.parent.mkdir(parents=True)
            file.write_text(__import__("json").dumps({"beforeDisplaySha256": review.display_hash(before), "afterDisplaySha256": review.display_hash(after), "display": review.display_payload(after)}), encoding="utf-8")
            self.assertEqual(review.apply_revision(before, "shuimu"), after)
            self.assertEqual(review.apply_revision(after, "shuimu"), after)
            updated = copy.deepcopy(before)
            updated["blocks"][0]["text"] = "changed"
            with self.assertRaises(ValueError): review.apply_revision(updated, "shuimu")

    def test_non_whitespace_change_requires_source_evidence(self):
        before = {"text": "wande门ng cow", "blocks": [{"type": "paragraph", "text": "wande门ng cow"}]}
        after = {"text": "wandering cow", "blocks": [{"type": "paragraph", "text": "wandering cow"}]}
        with self.assertRaises(ValueError): review.validate_change(before, after)
        review.validate_change(before, after, [{"before": "wande门ng", "after": "wandering", "evidence": "Original PDF page 2, question 5"}])

    def test_timing_is_immutable(self):
        before = {"text": "Who?\nHi.", "question": "Who?", "bodyText": "Hi.", "bodyTextZh": "你好。", "sentences": [{"en": "Hi.", "zh": "你好。", "role": "body", "index": 0, "startTime": 1.0, "endTime": 2.0}]}
        after = copy.deepcopy(before)
        review.validate_change(before, after)
        after["sentences"][0]["startTime"] = 0
        with self.assertRaises(ValueError): review.validate_change(before, after)

    def test_paragraph_merge_preserves_order(self):
        before = {"text": "A long\nsentence.\nB) Answer", "blocks": [{"type": "paragraph", "text": t} for t in ("A long", "sentence.", "B) Answer")]}
        after = {"text": "A long sentence.\nB) Answer", "blocks": [{"type": "paragraph", "text": t} for t in ("A long sentence.", "B) Answer")]}
        review.validate_change(before, after)
        after["text"] = "B) Answer\nA long sentence."
        after["blocks"].reverse()
        with self.assertRaises(ValueError): review.validate_change(before, after)

    def test_body_evidence_does_not_authorize_other_fields(self):
        before = {"title": "Original", "text": "wrong", "blocks": [{"type": "paragraph", "text": "wrong"}]}
        after = {"title": "Invented", "text": "right", "blocks": [{"type": "paragraph", "text": "right"}]}
        evidence = [{"before": "wrong", "after": "right", "evidence": "PDF page 2"}]
        with self.assertRaises(ValueError): review.validate_change(before, after, evidence)
        after["title"] = before["title"]
        review.validate_change(before, after, evidence)

    def test_generator_alias_is_exact_and_source_guarded(self):
        before = {"id": "unit-001", "title": "T", "text": "Jimmy今天", "blocks": [{"type": "paragraph", "text": "Jimmy今天"}]}
        after = review.candidate(before)
        generated = copy.deepcopy(before)
        generated["text"] = "Jimmy  今天"
        generated["blocks"][0]["text"] = generated["text"]
        with tempfile.TemporaryDirectory() as tmp, patch.object(review, "REVIEW_ROOT", Path(tmp)):
            source = Path(tmp) / "source.txt"; source.write_text("Original source")
            revision = review.revision_path("shuimu", before["id"]); revision.parent.mkdir(parents=True)
            revision.write_text(json.dumps({"beforeDisplaySha256": review.display_hash(before), "afterDisplaySha256": review.display_hash(after), "baselineDisplay": review.display_payload(before), "display": review.display_payload(after)}))
            with self.assertRaises(ValueError): review.apply_revision(generated, "shuimu")
            review.register_generator_baseline(generated, "shuimu", source, "Reviewed page 1")
            self.assertEqual(review.apply_revision(generated, "shuimu"), after)
            different = copy.deepcopy(generated); different["text"] = "Jimmy 今天"
            different["blocks"][0]["text"] = "Jimmy 今天!"
            with self.assertRaises(ValueError): review.apply_revision(different, "shuimu")
            source.write_text("Changed source")
            with self.assertRaises(ValueError): review.apply_revision(generated, "shuimu")

    def test_output_replacement_is_confined(self):
        self.assertEqual(review.checked_output_root(review.ROOT / "tmp/article-review/nce", "nce"), (review.ROOT / "tmp/article-review/nce").resolve())
        for path in (review.ROOT, review.ROOT / "tmp", review.ROOT / "public/shuimu"):
            with self.assertRaises(ValueError): review.checked_output_root(path, "nce")

    def test_rereview_replays_verified_history_from_original_generator(self):
        before = {"id": "unit-001", "title": "T", "text": "a pound note中文", "blocks": [{"type": "paragraph", "text": "a pound note中文"}]}
        first = review.candidate(before)
        latest = copy.deepcopy(first)
        latest["text"] = latest["text"].replace("a pound note", "a ten-pound note")
        latest["blocks"][0]["text"] = latest["text"]
        old = {"course": "shuimu", "articleId": before["id"], "beforeDisplaySha256": review.display_hash(before), "afterDisplaySha256": review.display_hash(first), "display": review.display_payload(first)}
        old_hash = review.canonical_hash(old)
        new = {"course": "shuimu", "articleId": before["id"], "previousRevisionSha256": old_hash, "beforeDisplaySha256": review.display_hash(first), "afterDisplaySha256": review.display_hash(latest), "display": review.display_payload(latest), "corrections": [{"before": "a pound note", "after": "a ten-pound note", "evidence": "Original subtitle"}]}
        with tempfile.TemporaryDirectory() as tmp, patch.object(review, "REVIEW_ROOT", Path(tmp)):
            file = review.revision_path("shuimu", before["id"]); file.parent.mkdir(parents=True)
            file.write_text(json.dumps(new), encoding="utf-8")
            archive = Path(tmp) / "history" / f"{old_hash}.json"; archive.parent.mkdir()
            archive.write_text(json.dumps(old), encoding="utf-8")
            self.assertEqual(review.apply_revision(before, "shuimu"), latest)
            self.assertEqual(review.apply_revision(first, "shuimu"), latest)
            self.assertEqual(review.apply_revision(latest, "shuimu"), latest)
            archive.write_text(json.dumps({**old, "articleId": "another"}), encoding="utf-8")
            with self.assertRaises(ValueError): review.apply_revision(before, "shuimu")

    def test_whitespace_alias_replays_precise_source_correction(self):
        before = {"id": "unit-001", "title": "T", "text": "1. He was there.", "blocks": [{"type": "paragraph", "text": "1. He was there."}]}
        generated = copy.deepcopy(before)
        generated["text"] = generated["blocks"][0]["text"] = "1.He was there."
        after = copy.deepcopy(before)
        after["text"] = after["blocks"][0]["text"] = "1. He was ____ there."
        correction = {"before": before["text"], "after": after["text"], "evidence": "PDF image shows blank"}
        with tempfile.TemporaryDirectory() as tmp, patch.object(review, "REVIEW_ROOT", Path(tmp)):
            source = Path(tmp) / "source.txt"; source.write_text("Original")
            file = review.revision_path("shuimu", before["id"]); file.parent.mkdir(parents=True)
            file.write_text(json.dumps({"beforeDisplaySha256": review.display_hash(before), "afterDisplaySha256": review.display_hash(after), "baselineDisplay": review.display_payload(before), "display": review.display_payload(after), "corrections": [correction]}), encoding="utf-8")
            review.register_generator_baseline(generated, "shuimu", source, "Page 1")
            self.assertEqual(review.apply_revision(generated, "shuimu"), after)

    def test_generator_proof_survives_paragraph_rereview_with_guarded_history(self):
        before = {"id": "unit-001", "text": "One.\nTwo.", "blocks": [{"type": "paragraph", "text": "One."}, {"type": "paragraph", "text": "Two."}]}
        first = {**before, "text": "One. Two.", "blocks": [{"type": "paragraph", "text": "One. Two."}]}
        old = {"course": "shuimu", "articleId": before["id"], "beforeDisplaySha256": review.display_hash(before), "afterDisplaySha256": review.display_hash(first), "baselineDisplay": review.display_payload(before)}
        old_hash = review.canonical_hash(old)
        new = {**old, "previousRevisionSha256": old_hash, "beforeDisplaySha256": review.display_hash(first), "baselineDisplay": review.display_payload(first)}
        with tempfile.TemporaryDirectory() as tmp, patch.object(review, "REVIEW_ROOT", Path(tmp)):
            archive = Path(tmp) / "history" / f"{old_hash}.json"; archive.parent.mkdir()
            archive.write_text(json.dumps(old), encoding="utf-8")
            self.assertEqual(review.find_baseline_revision(new, review.display_hash(before)), old)
            with self.assertRaises(ValueError):
                review.find_baseline_revision({**new, "beforeDisplaySha256": "broken"}, review.display_hash(before))
            archive.write_text(json.dumps({**old, "articleId": "another"}), encoding="utf-8")
            with self.assertRaises(ValueError):
                review.find_baseline_revision(new, review.display_hash(before))

    def test_college_latest_revision_preserves_signature_chain(self):
        original = {"articleId": "rw1-u01-a", "toStatus": "passed", "eventSha256": "first", "afterTextSha256": "old"}
        latest = {**original, "eventType": "revision", "fromStatus": "passed", "eventSha256": "second", "supersedesEventSha256": "first", "beforeTextSha256": "old", "afterTextSha256": "new", "fullReadConfirmed": True, "reviewer": "Reviewer", "reviewedAt": "date", "evidence": "PDF page 1", "sourcePages": {"printed": [1, 2]}}
        row = {"baselineId": "rw1-u01-a", "status": "passed", "reviewer": "Reviewer", "reviewedAt": "date", "evidence": "PDF page 1", "textSha256": "new", "eventSha256": "second", "printedPageStart": "1", "printedPageEnd": "2", "risk": "low"}
        with patch.object(college, "reviewed_article", return_value=({}, "new text", "new")):
            self.assertEqual(college.validate_passed_rows([row], [original, latest]), [row])
            for key, value in [("supersedesEventSha256", "wrong"), ("beforeTextSha256", "wrong"), ("fullReadConfirmed", False)]:
                with self.subTest(key=key), self.assertRaises(RuntimeError):
                    college.validate_passed_rows([row], [original, {**latest, key: value}])


if __name__ == "__main__":
    unittest.main()
