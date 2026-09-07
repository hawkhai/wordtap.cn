# PEP English source notes

This file records source discovery for PEP books that are not currently
available to the generator. Public availability is not a redistribution
license; the repository's third-party notice continues to apply.

## `pephg` 高中英语语法与词汇

- Edition: 2003 curriculum-standard experimental elective textbook, first
  published by People's Education Press in the 2007 period.
- ISBN: `9787107202544` (`7107202545`).
- Existing catalog slug: `gzxxd4c`.
- Catalog index: <http://www.dzkbw.com/books/rjb/yingyu/gzxxd4c/>.
- Verified table of contents:
  1. IDENTIFY PEOPLE AND THINGS
  2. IDENTIFY WHAT YOU ARE TALKING ABOUT
  3. ADD MORE INFORMATION
  4. NUMBERS AND QUANTITIES
  5. ACTION AND STATE (I)
  6. ACTION AND STATE (II)
  7. TIME AND ACTION
  8. LOCATION AND DIRECTION
  9. EXPRESS SENSES AND FEELINGS
  10. EXPRESS JUDGEMENT AND ATTITUDE
  11. DELIVER MESSAGES IN DIFFERENT WAYS (I)
  12. DELIVER MESSAGES IN DIFFERENT WAYS (II)
  13. COMBINE SENTENCES
  14. MORE WAYS TO COMBINE SENTENCES
- Evidence that the title is an approved PEP elective remains available in
  provincial education-department textbook catalogs, for example:
  <https://www.yantai.gov.cn/module/download/downfile.jsp?classid=0&filename=3c4ccb2b31674027bf48c57ed8e0355f.pdf&showname=2024%E5%B9%B4%E4%B8%AD%E5%B0%8F%E5%AD%A6%E6%95%99%E5%AD%A6%E7%94%A8%E4%B9%A6.pdf>.

## `pephw` 英语写作

- Edition: 2003 curriculum-standard experimental elective textbook.
- Publisher: People's Education Press; May 2007; 89 pages.
- ISBN: `9787107186936`.
- English title: *Writing in English*.
- Existing catalog slug: `gzxxd5c`.
- Bibliographic record: <https://book.douban.com/subject/6722455/>.
- Catalog index: <http://www.dzkbw.com/books/rjb/yingyu/gzxxd5c/>.
- Verified table of contents:
  1. Greeting cards and notes
  2. Diaries
  3. Information reports
  4. Application forms and letters
  5. Personal letters and descriptions of people
  6. Emails and descriptions of places
  7. Information reports and graphs
  8. Dramatic stories
  9. Suggestion letters
  10. Argumentations

## Discovery result

Checked on 2026-09-03:

- The current PEP electronic-textbook catalog at <https://jc.pep.com.cn/>
  contains 780 records but neither of these retired 2007 editions.
- The two Dzkbw catalog entries still exist, but their former SmartEdu links
  now resolve only to the general PEP high-school English catalog and no
  longer expose a `contentId` or source PDF.
- SmartEdu's current public search endpoint
  (`https://x-search.ykt.eduyun.cn/v1/resources/search`) was also checked by
  exact title, ISBN and English title. It returns related lessons and current
  English textbooks, but no exact PEP textbook record for either retired
  edition. The fetcher now uses this endpoint as a second official discovery
  path and rejects fuzzy-title or non-PEP matches.
- Ministry/provincial “一师一优课” award lists confirm that lesson resources
  once existed for units 3, 9, 10, 11, 13 and 14 of `pephg`, and units 1, 2,
  3, 4, 6 and 7 of `pephw`. Those lists provide catalog evidence only: the
  current SmartEdu search index does not expose the corresponding retired
  course packages or a complete source textbook.
- Some provincial award lists preserve legacy course IDs, including
  `8aee80966b059ca0016b07a618dc10b9` (grammar/vocabulary unit 13),
  `8aee80966b059ca0016b07fd6e4d161d` (grammar/vocabulary unit 11),
  `8aee80a46a2dc01d016a2f5625980c74` (writing unit 4),
  `8aee80966b52dbee016b560df4ba070d` (writing unit 6), and
  `8aee80ca6aa8ee77016aac4076660337` (writing unit 7). The former
  `1s1k.eduyun.cn` host no longer resolves, and loading these IDs through the
  replacement SmartEdu preparation site returns its unavailable-resource
  page. They therefore cannot serve as a complete or reproducible import.
- The replacement preparation site's static-data API was also checked
  directly. A current teaching-material ID returns HTTP 200 for its details,
  chapter tree and resource list under
  `s-file-*.ykt.cbern.com.cn/zxx/ndrs/prepare_lesson/`; all five legacy IDs
  above return HTTP 403 on every corresponding teaching-material and resource
  endpoint. This control comparison confirms that the result is retired or
  unmigrated data rather than a malformed request.
- Wayback Machine snapshots of the old Dzkbw indexes preserve the unit links
  and some page-image snapshots. These are third-party scans of copyrighted
  textbooks, not publisher-authorized source files or a redistribution grant,
  so they are evidence for the edition and table of contents only and are not
  imported.
- Internet Archive searches by both ISBNs and exact titles returned no items.
- Full scans found on document-sharing or shadow-library sites have no
  verifiable redistribution permission and are deliberately not imported.
- The similarly named 2025 "学科核心素养提升用书" titles are new editions. They must not
  silently replace the cataloged 2007 textbooks without an explicit migration
  and content review.

## Authorized local import

If legally obtained PDFs are available, place them at:

```text
content/pep-english/raw/senior-grammar-vocabulary.pdf
content/pep-english/raw/senior-writing.pdf
```

Then run:

```powershell
python tools/fetch-pep-english.py --book pephg
python tools/fetch-pep-english.py --book pephw
npm run generate:pep-english -- --book pephg
npm run generate:pep-english -- --book pephw
npm run verify:pep-english
```

The fetch step recognizes a valid local PDF only after the official remote
sources fail, records its size and MD5, and marks its origin as
`local-authorized-source`. Generated passages still require the same page-level
manual review used for the other PEP books.
