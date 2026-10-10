import copy
import unittest
from pep_article_identity import assign_published_identities
from pep_display import paragraph_block


def article(number, page, split=0):
    return dict(groupId='sample', id=f'sample-{number:03d}', sequenceNo=number,
                jsonPath=f'pep-english/lessons/sample/{number:03d}.json',
                source=dict(pdfMd5='a' * 32, pageStart=page, pageEnd=page,
                            manualReview=dict(splitIndex=split)))


class StableIdentityTests(unittest.TestCase):
    def test_explicit_bullets_preserve_list_and_text(self):
        text = '• Be focused. Follow your interests.\n• Be safe. Tell your parents.'
        self.assertEqual(paragraph_block(text), {'type': 'list', 'lang': 'en', 'text': text})

    def test_prose_with_bullet_is_not_a_list(self):
        for text in ('A symbol • can appear in prose.', 'Introduction\n• One example.', ''):
            self.assertEqual(paragraph_block(text)['type'], 'paragraph')

    def test_deleted_candidates_do_not_renumber_survivors(self):
        expected = [article(2, 21), article(9, 45)]
        generated = [article(1, 45), article(2, 21)]
        assign_published_identities(generated, expected, 'sample')
        self.assertEqual([x['id'] for x in generated], ['sample-009', 'sample-002'])
        self.assertEqual(generated[0]['jsonPath'], expected[1]['jsonPath'])

    def test_split_articles_on_same_page_keep_distinct_ids(self):
        expected = [article(4, 10, 1), article(5, 10, 2)]
        generated = [article(1, 10, 2), article(2, 10, 1)]
        assign_published_identities(generated, expected, 'sample')
        self.assertEqual([x['sequenceNo'] for x in generated], [5, 4])

    def test_source_changes_and_missing_or_duplicate_articles_fail_closed(self):
        expected = [article(2, 21), article(9, 45)]
        changed_pdf = copy.deepcopy(expected)
        changed_pdf[0]['source']['pdfMd5'] = 'b' * 32
        for generated in ([article(1, 22), article(2, 45)], [article(1, 21)],
                          [article(1, 21), article(2, 21)], changed_pdf):
            before = copy.deepcopy(generated)
            with self.assertRaises(ValueError):
                assign_published_identities(generated, expected, 'sample')
            self.assertEqual(generated, before)


if __name__ == '__main__':
    unittest.main()
