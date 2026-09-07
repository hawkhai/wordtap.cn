#!/usr/bin/env python3
"""Offline unit tests for PEP English download integrity and fallback behavior."""

from __future__ import annotations

import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).with_name("fetch-pep-english.py")
SPEC = importlib.util.spec_from_file_location("fetch_pep_english", MODULE_PATH)
fetch = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(fetch)


class DownloadTests(unittest.TestCase):
    def test_pdf_magic_size_and_md5(self):
        with tempfile.TemporaryDirectory() as directory:
            pdf = Path(directory) / "book.pdf"
            payload = b"%PDF-1.7\n" + b"x" * 2048
            pdf.write_bytes(payload)
            digest = hashlib.md5(payload).hexdigest()
            self.assertTrue(fetch.valid_pdf(pdf, len(payload), digest))
            self.assertFalse(fetch.valid_pdf(pdf, len(payload) + 1, digest))
            self.assertFalse(fetch.valid_pdf(pdf, len(payload), "0" * 32))

    def test_numbered_parts_sort_numerically(self):
        book = fetch.PepBook("sample", "junior", 1, 1, "样书", "sample.pdf", "sample", "a/sample.pdf")
        entries = [
            {"name": "sample.pdf.010", "download_url": "10"},
            {"name": "sample.pdf.002", "download_url": "2"},
            {"name": "sample.pdf.001", "download_url": "1"},
        ]
        with patch.object(fetch, "read_url", return_value=fetch.json.dumps(entries).encode()):
            self.assertEqual([url for _, url in fetch.discover_github_parts(book)], ["1", "2", "10"])

    def test_missing_sources_are_recorded(self):
        book = fetch.PepBook("missing", "senior", 2, 1, "缺失", "missing.pdf", "missing")
        with patch.object(fetch, "discover_smartedu", side_effect=FileNotFoundError("not found")), \
                patch.object(fetch, "discover_smartedu_search", side_effect=FileNotFoundError("not found")):
            result = fetch.fetch_book(book)
        self.assertEqual(result["status"], "missing")
        self.assertTrue(result["errors"])

    def test_authorized_local_pdf_is_used_after_remote_sources_fail(self):
        book = fetch.PepBook("local", "senior", 2, 1, "本地样书", "local.pdf", "local")
        payload = b"%PDF-1.7\n" + b"x" * 2048
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            raw = root / "raw"
            raw.mkdir()
            (raw / book.filename).write_bytes(payload)
            with patch.object(fetch, "RAW_DIR", raw), \
                    patch.object(fetch, "ROOT", root), \
                    patch.object(fetch, "discover_smartedu", side_effect=FileNotFoundError("not found")), \
                    patch.object(fetch, "discover_smartedu_search", side_effect=FileNotFoundError("not found")):
                result = fetch.fetch_book(book)
        self.assertEqual(result["status"], "available")
        self.assertEqual(result["origin"], "local-authorized-source")
        self.assertEqual(result["md5"], hashlib.md5(payload).hexdigest())

    def test_github_failure_falls_back_to_smartedu(self):
        book = fetch.PepBook("fallback", "senior", 2, 1, "补源", "fallback.pdf", "fallback", "a/fallback.pdf")
        metadata = {"origin": "smartedu", "downloadUrl": "smart", "expectedSize": None, "expectedMd5": None}

        def fake_download(url, destination, **_kwargs):
            if url != "smart":
                raise OSError("github unavailable")
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(b"%PDF-1.7\n" + b"x" * 2048)

        with tempfile.TemporaryDirectory() as directory, \
                patch.object(fetch, "RAW_DIR", Path(directory)), \
                patch.object(fetch, "ROOT", Path(directory)), \
                patch.object(fetch, "download", side_effect=fake_download), \
                patch.object(fetch, "download_github_parts", side_effect=FileNotFoundError("no parts")), \
                patch.object(fetch, "discover_smartedu", return_value=metadata):
            result = fetch.fetch_book(book)
        self.assertEqual(result["status"], "available")
        self.assertEqual(result["origin"], "smartedu")

    def test_smartedu_search_requires_exact_pep_result(self):
        book = fetch.PepBook("search", "senior", 2, 1, "英语写作", "search.pdf", "search")
        fuzzy = {"items": [{
            "title": "英语写作专题一",
            "src_content_id": "fuzzy",
            "extra": {"providers": [{"name": "人民教育出版社"}]},
            "tags": [],
        }]}
        with patch.object(fetch, "post_json", return_value=fuzzy):
            with self.assertRaises(FileNotFoundError):
                fetch.discover_smartedu_search(book)

    def test_smartedu_search_accepts_exact_pep_result(self):
        book = fetch.PepBook("search", "senior", 2, 1, "英语写作", "search.pdf", "search")
        exact = {"items": [{
            "title": "普通高中教科书·英语写作",
            "src_content_id": "exact-id",
            "extra": {"providers": [{"name": "人民教育出版社"}]},
            "tags": [],
        }]}
        metadata = {"origin": "smartedu", "contentId": "exact-id"}
        with patch.object(fetch, "post_json", return_value=exact), \
                patch.object(fetch, "smartedu_source", return_value=metadata):
            self.assertEqual(fetch.discover_smartedu_search(book), metadata)


if __name__ == "__main__":
    unittest.main()
