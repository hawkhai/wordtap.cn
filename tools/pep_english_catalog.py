"""Fixed PEP English textbook catalog used by download and conversion tools."""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class PepBook:
    id: str
    stage: str
    stage_order: int
    book_order: int
    title: str
    filename: str
    dzkbw_slug: str
    github_path: str | None = None

    def as_dict(self) -> dict:
        return asdict(self)


GITHUB_PREFIX = "https://raw.githubusercontent.com/TapXWorld/ChinaTextbook/master/"
PUBLISHER_PATH = "人教版-人民教育出版社"


BOOKS = (
    PepBook("pepj7a", "junior", 1, 1, "七年级上册", "junior-7a.pdf", "xc7s_2024",
            f"初中/英语/{PUBLISHER_PATH}/七年级/义务教育教科书·英语七年级上册.pdf"),
    PepBook("pepj7b", "junior", 1, 2, "七年级下册", "junior-7b.pdf", "xc7x_2025",
            f"初中/英语/{PUBLISHER_PATH}/七年级/义务教育教科书·英语七年级下册.pdf"),
    PepBook("pepj8a", "junior", 1, 3, "八年级上册", "junior-8a.pdf", "xc8s_2025",
            f"初中/英语/{PUBLISHER_PATH}/八年级/义务教育教科书·英语八年级上册.pdf"),
    PepBook("pepj8b", "junior", 1, 4, "八年级下册", "junior-8b.pdf", "xc8x_2026",
            f"初中/英语/{PUBLISHER_PATH}/八年级/义务教育教科书·英语八年级下册.pdf"),
    PepBook("pepj9", "junior", 1, 5, "九年级全一册", "junior-9.pdf", "xc9q",
            f"初中/英语/{PUBLISHER_PATH}/九年级/义务教育教科书·英语九年级全一册.pdf"),
    PepBook("pephr1", "senior", 2, 1, "必修第一册", "senior-required-1.pdf", "gzbxd1c",
            f"高中/英语/{PUBLISHER_PATH}/普通高中教科书·英语必修 第一册.pdf"),
    PepBook("pephr2", "senior", 2, 2, "必修第二册", "senior-required-2.pdf", "gzbxd2c",
            f"高中/英语/{PUBLISHER_PATH}/普通高中教科书·英语必修 第二册.pdf"),
    PepBook("pephr3", "senior", 2, 3, "必修第三册", "senior-required-3.pdf", "gzbxd3c",
            f"高中/英语/{PUBLISHER_PATH}/普通高中教科书·英语必修 第三册.pdf"),
    PepBook("pephs1", "senior", 2, 4, "选择性必修第一册", "senior-selective-1.pdf", "gzxzxbxd1c",
            f"高中/英语/{PUBLISHER_PATH}/普通高中教科书·英语选择性必修 第一册.pdf"),
    PepBook("pephs2", "senior", 2, 5, "选择性必修第二册", "senior-selective-2.pdf", "gzxzxbxd2c",
            f"高中/英语/{PUBLISHER_PATH}/普通高中教科书·英语选择性必修 第二册.pdf"),
    PepBook("pephs3", "senior", 2, 6, "选择性必修第三册", "senior-selective-3.pdf", "gzxzxbxd3c",
            f"高中/英语/{PUBLISHER_PATH}/普通高中教科书·英语选择性必修 第三册.pdf"),
    PepBook("pephs4", "senior", 2, 7, "选择性必修第四册", "senior-selective-4.pdf", "gzxzxbxd4c",
            f"高中/英语/{PUBLISHER_PATH}/普通高中教科书·英语选择性必修 第四册.pdf"),
    PepBook("pephe1", "senior", 2, 8, "选修第一册", "senior-elective-1.pdf", "gzxxd1c"),
    PepBook("pephe2", "senior", 2, 9, "选修第二册", "senior-elective-2.pdf", "gzxxd2c"),
    PepBook("pephe3", "senior", 2, 10, "选修第三册", "senior-elective-3.pdf", "gzxxd3c"),
    PepBook("pephg", "senior", 2, 11, "英语语法与词汇", "senior-grammar-vocabulary.pdf", "gzxxd4c"),
    PepBook("pephw", "senior", 2, 12, "英语写作", "senior-writing.pdf", "gzxxd5c"),
)

BOOK_BY_ID = {book.id: book for book in BOOKS}
