#!/usr/bin/env python3
"""Authoritative College English article catalog transcribed from Map of the book.

The catalog deliberately contains only Text A, Text B, and Stories of China.
Page ranges are candidate review spans: they begin at the article's directory
page and end immediately before the next named teaching component.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PRINTED_PAGE_OFFSET = 15


@dataclass(frozen=True)
class Article:
    id: str
    sequence_no: int
    group_id: str
    source_book: str
    book_title: str
    unit_no: int
    unit_title: str
    section: str
    article_type: str
    title: str
    printed_page_start: int
    printed_page_end: int

    @property
    def pdf_page_start(self) -> int:
        return self.printed_page_start + PRINTED_PAGE_OFFSET

    @property
    def pdf_page_end(self) -> int:
        return self.printed_page_end + PRINTED_PAGE_OFFSET

    @property
    def ocr_pages(self) -> range:
        return range(self.pdf_page_start, self.pdf_page_end + 1)


BOOKS = (
    {
        "group_id": "rw1",
        "source_book": "NHCE4-RW1",
        "book_title": "读写教程 1",
        "ocr_pages": 183,
        "pdf_pages": 183,
        "units": (
            ("Fresh start", ("Toward a brighter future for all", 4, 13), ("What we wish", 18), ("The post-00s looking forward to a colorful life", 25, 27)),
            ("Loving parents, loving children", ("A child’s clutter awaits an adult’s return", 30, 39), ("Time slows down", 43), ("Bonds of love", 51, 53)),
            ("Heroes of our time", ("To feed the world", 56, 65), ("Heroes among us", 69), ("Cering Dandar, a grassroots hero", 77, 79)),
            ("Social media matters", ("Social media: How much is too much", 82, 91), ("Staying connected", 96), ("Chinese people love their social media apps", 103, 105)),
            ("Friendship across border and gender", ("Firm belief, eternal friendship", 108, 117), ("Gender variables in friendship: Contradiction or not?", 121), ("Picture this: Friends forever", 129, 131)),
            ("Winning is not everything", ("Cliff Young, an extraordinary runner", 134, 137), ("Shaping young lives with sports", 147, 150), ("Lessons China can teach us about fitness", 155, 157)),
        ),
    },
    {
        "group_id": "rw2",
        "source_book": "NHCE4-RW2",
        "book_title": "读写教程 2",
        "ocr_pages": 176,
        "pdf_pages": 177,
        "units": (
            ("Language in mission", ("An impressive English lesson", 4, 7), ("The great journey of learning", 18, 20), ("What challenges learners of Chinese?", 25, 27)),
            ("Exploring college majors", ("The road to my major", 30, 33), ("The humanities: out of date?", 44, 46), ("From a security guard to a university teacher", 51, 53)),
            ("The young generation: making a difference", ("The young generation – the future of China", 57, 59), ("Understanding the young generation", 69, 72), ("Aiming to bring agriculture online", 77, 79)),
            ("Mission and exploration of our time", ("Huang Danian, a strategic scientist", 82, 85), ("Journey through the odyssey years", 95, 98), ("The May Fourth spirit alive in China", 103, 105)),
            ("Striving for financial health", ("Spend or save – the student’s dilemma", 108, 111), ("A $3,000 dictionary", 122, 125), ("Project Hope", 131, 133)),
            ("Less is more", ("Door closer, are you?", 136, 139), ("When enough is enough", 151, 154), ("A boom in shopping malls", 159, 161)),
        ),
    },
    {
        "group_id": "rw3",
        "source_book": "NHCE4-RW3",
        "book_title": "读写教程 3",
        "ocr_pages": 176,
        "pdf_pages": 177,
        "units": (
            ("The digital age: Are we ready?", ("Connection or conversation", 5, 8), ("Living in the digital world", 20, 22), ("A smartphone is all you need", 27, 29)),
            ("Life stories", ("Zheng He, the great ancient Chinese explorer", 32, 35), ("Audrey Hepburn – a true angel in this world", 46, 48), ("Mei Lanfang – a Peking Opera legend", 54, 56)),
            ("Let’s go", ("The surprising purpose of travel", 60, 63), ("Traveling solo – a blessing overall!", 74, 76), ("Touring the world after 60", 81, 83)),
            ("When work is a pleasure", ("Will you be a worker or a laborer?", 87, 89), ("The joy of a prideful tradition", 99, 101), ("Glassware on fire", 107, 109)),
            ("China's space dream", ("No limit for China’s astronauts in their space exploration endeavors", 112, 115), ("Chang’e-4 kicked off a new space odyssey", 125, 128), ("China aims for peaceful use of space exploration", 133, 135)),
            ("The economy: power behind everyday life", ("Surviving an economic crisis", 138, 141), ("Economic bubbles: causes and conditions", 151, 154), ("The sharing economy turns a new page with books", 159, 161)),
        ),
    },
    {
        "group_id": "rw4",
        "source_book": "NHCE4-RW4",
        "book_title": "读写教程 4",
        "ocr_pages": 190,
        "pdf_pages": 191,
        "units": (
            ("Urban development", ("From urbanization to smart cities", 5, 8), ("Embrace the trend of deurbanization", 18, 21), ("Limited space, unlimited growth", 27, 29)),
            ("Secrets to beauty", ("Making the choice to be truly beautiful", 33, 36), ("The exploration of beauty", 48, 51), ("A beautiful heart that has made a difference", 57, 59)),
            ("Business success in the new age", ("China’s new wave of young innovators", 63, 66), ("Culture makes the business world go round", 78, 81), ("The rise of modern entrepreneurship in China", 87, 89)),
            ("Man and nature", ("Save the earth, save life", 93, 96), ("What nature is telling you", 107, 109), ("A green finish line", 115, 117)),
            ("Passion guides life choices", ("A meaningful life", 120, 123), ("A turning point in my life", 133, 136), ("Passion and dedication have propelled China’s space science to new heights", 143, 145)),
            ("Energy and food crises", ("The coming energy crisis", 149, 152), ("A worldwide food crisis?", 164, 167), ("An important milestone in China’s solar energy development", 173, 175)),
        ),
    },
)


def all_articles() -> list[Article]:
    articles: list[Article] = []
    sequence_no = 0
    for book in BOOKS:
        for unit_no, (unit_title, text_a, text_b, story) in enumerate(book["units"], start=1):
            sequence_no += 1
            articles.append(Article(
                id=f"{book['group_id']}-u{unit_no:02d}-a",
                sequence_no=sequence_no,
                group_id=book["group_id"],
                source_book=book["source_book"],
                book_title=book["book_title"],
                unit_no=unit_no,
                unit_title=unit_title,
                section="A",
                article_type="text-a",
                title=text_a[0],
                printed_page_start=text_a[1],
                printed_page_end=text_a[2] - 1,
            ))
            sequence_no += 1
            articles.append(Article(
                id=f"{book['group_id']}-u{unit_no:02d}-b",
                sequence_no=sequence_no,
                group_id=book["group_id"],
                source_book=book["source_book"],
                book_title=book["book_title"],
                unit_no=unit_no,
                unit_title=unit_title,
                section="B",
                article_type="text-b",
                title=text_b[0],
                printed_page_start=text_b[1],
                printed_page_end=(text_b[2] - 1) if len(text_b) > 2 else (story[1] - 1),
            ))
            sequence_no += 1
            articles.append(Article(
                id=f"{book['group_id']}-u{unit_no:02d}-c",
                sequence_no=sequence_no,
                group_id=book["group_id"],
                source_book=book["source_book"],
                book_title=book["book_title"],
                unit_no=unit_no,
                unit_title=unit_title,
                section="C",
                article_type="stories-of-china",
                title=story[0],
                printed_page_start=story[1],
                printed_page_end=story[2] - 1,
            ))
    return articles


ARTICLE_BY_ID = {article.id: article for article in all_articles()}
BOOK_BY_ID = {book["group_id"]: book for book in BOOKS}
