import json
import unittest
from english_vocabulary import BOOKS, parse_entries, reading_entry, typing_text


class VocabularyTests(unittest.TestCase):
    def test_missing_optional_fields_and_headword_fallback(self):
        entries = parse_entries(b'{"word":"well-known"}\n', "fixture")
        self.assertEqual(reading_entry(entries[0]), "well-known")
        self.assertEqual(typing_text(entries), "well-known")

    def test_all_source_fields_and_examples_are_preserved(self):
        entry = dict(word="talk", uk="tɔːk", us="tɔk",
            translations=[dict(type="v", translation="谈话"), dict(type="n", translation="交谈")],
            phrases=[dict(phrase="talk about", translation="谈论")],
            sentences=[dict(sentence="Let's talk.", translation="谈谈吧。"), dict(sentence="We talked!", translation="我们交谈了！")])
        parsed = parse_entries((json.dumps(entry) + "\n").encode(), "fixture")[0]
        self.assertEqual(parsed, entry)
        text = reading_entry(parsed)
        for field in ["英 /tɔːk/", "美 /tɔk/", "v. 谈话", "n. 交谈", "talk about", "谈谈吧。", "We talked!"]:
            self.assertIn(field, text)
        self.assertEqual(typing_text([entry]), "Let's talk.\n\nWe talked!")

    def test_duplicates_are_not_dropped(self):
        entries = parse_entries(b'{"word":"talk"}\n{"word":"talk"}\n', "fixture")
        self.assertEqual(len(entries), 2)
        self.assertEqual(typing_text(entries), "talk\n\ntalk")

    def test_invalid_data_fails_with_location(self):
        for text in ['{broken}', '{"word":""}', '{"word":"x","uk":"�"}', '{"word":"x","sentences":"bad"}', '{"word":"x","sentences":[{"sentence":""}]}']:
            with self.subTest(text=text), self.assertRaisesRegex(ValueError, "fixture:1"):
                parse_entries(text.encode("utf-8"), "fixture")

    def test_identifiers_and_all_23_books(self):
        self.assertEqual(len(BOOKS), 23)
        self.assertEqual(len({book[0] for book in BOOKS}), 23)
        self.assertEqual(len({book[1] for book in BOOKS}), 23)
        self.assertTrue(all(book[0].startswith("ev") for book in BOOKS))

    def test_approved_issues_preserve_exact_original_and_reject_drift(self):
        entry = dict(word="fish", sentences=[dict(sentence="", translation="保留译文。")], uk="�")
        issues = [dict(book="fixture", line=1, field=".sentences[0].sentence", value="", action="preserve-upstream"),
                  dict(book="fixture", line=1, field=".uk", value="�", action="preserve-upstream")]
        data = (json.dumps(entry) + "\n").encode()
        self.assertEqual(parse_entries(data, "fixture", issues), [entry])
        self.assertIn("保留译文。", reading_entry(entry))
        self.assertEqual(typing_text([entry]), "fish")
        with self.assertRaisesRegex(ValueError, "known issue changed"):
            parse_entries(data.replace(b'\\ufffd', b'new'), "fixture", issues)


if __name__ == "__main__":
    unittest.main()
