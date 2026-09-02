"""Extract the 20 reading texts from the OneOCR output for 李知宇《研究生英语读写译教程》."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path


VOLUME_ID = "reading-writing-translation"
WORD_CONFIDENCE = 0.70
LOW_CONFIDENCE_WORDS_TO_KEEP = {
    "a", "an", "as", "at", "be", "blind", "by", "do", "for", "he", "i", "in",
    "is", "it", "no", "of", "on", "only", "or", "so", "the", "to", "up", "we",
    "with", "you", "¢",
}


@dataclass(frozen=True)
class Article:
    unit_no: int
    text_label: str
    title: str
    author: str
    start_image: int
    end_image: int
    end_marker: str

    @property
    def article_no(self) -> int:
        return (self.unit_no - 1) * 2 + (1 if self.text_label == "A" else 2)

    @property
    def slug(self) -> str:
        return f"{self.unit_no:02d}{self.text_label.casefold()}"


ARTICLES = [
    Article(1, "A", "Stay Hungry. Stay Foolish.", "Steve Jobs", 12, 16, "NEW WORDS"),
    Article(1, "B", "Barack Obama's Victory Speech", "Barack Obama", 29, 34, "READING COMPREHENSION"),
    Article(2, "A", "Two Truths to Live By", "Alexander M. Schindler", 37, 40, "NEW WORDS"),
    Article(2, "B", "Approach to Life", "Lin Yutang", 55, 58, "READING COMPREHENSION"),
    Article(3, "A", "A Few Kind Words for Losing", "Joseph Epstein", 60, 64, "NEW WORDS"),
    Article(3, "B", "What Makes a Champion?", "Tony Blair", 77, 83, "READING COMPREHENSION"),
    Article(4, "A", "The Future of Books", "Umberto Eco", 85, 89, "NEW WORDS"),
    Article(4, "B", "Hypertextual Game and Interpretation of Texts", "Umberto Eco", 101, 105, "READING COMPREHENSION"),
    Article(5, "A", "Scientists, Scholars, Knaves and Fools", "Edward O. Wilson", 107, 112, "NEW WORDS"),
    Article(5, "B", "English Next...", "David Graddol", 125, 130, "READING COMPREHENSION"),
    Article(6, "A", "Anthropologists on the Front Lines", "Ken Stier", 133, 136, "NEW WORDS"),
    Article(6, "B", 'Book Review: "College: What It Was, Is, and Should Be" by Andrew Delbanco', "Michael S. Roth", 151, 154, "READING COMPREHENSION"),
    Article(7, "A", "Entropy", "K. C. Cole", 157, 161, "NEW WORDS"),
    Article(7, "B", "When the Pestilence Struck", "Giovanni Boccaccio", 174, 178, "READING COMPREHENSION"),
    Article(8, "A", "Of Ambition; Of Fortune", "Francis Bacon", 180, 184, "NEW WORDS"),
    Article(8, "B", "The Giving of Orders", "Mary Parker Follett", 198, 201, "READING COMPREHENSION"),
    Article(9, "A", "In DNA Era, New Worries About Prejudice", "Amy Harmon", 203, 208, "NEW WORDS"),
    Article(9, "B", "Are Your Genes to Blame?", "Steven Pinker", 220, 223, "READING COMPREHENSION"),
    Article(10, "A", "Fishes in the Concord River", "Henry David Thoreau", 226, 229, "NEW WORDS"),
    Article(10, "B", "A Strange Experience in Yosemite", "John Muir", 240, 243, "READING COMPREHENSION"),
]

UNIT_NAMES = {
    1: "Unit One",
    2: "Unit Two",
    3: "Unit Three",
    4: "Unit Four",
    5: "Unit Five",
    6: "Unit Six",
    7: "Unit Seven",
    8: "Unit Eight",
    9: "Unit Nine",
    10: "Unit Ten",
}

TOKEN_FIXES = {
    "nwo": "",
    "awcountry.": "country.",
    "129dcapture,": "capture,",
    "br/have": "have",
    "sveiover": "over",
    "obsmall": "small",
    "gthis": "this",
    "obit": "bit",
    "foom": "from",
    "beto": "to",
    "bthe": "the",
    "othe": "the",
    "ithe": "the",
    "lthe": "the",
    "lifetime": "lifetime",
    "echallenges": "challenges",
    "1ueverywhere.": "everywhere.",
    "oillustrates": "illustrates",
    "vdebate": "debate",
    "nodvaspects": "aspects",
    "oldthe": "the",
    "erscreen": "screen",
    "onof": "of",
    "baselse.": "else.",
    "asstimulus-text": "stimulus-text",
    "pécuchet": "Pécuchet",
    "\"global": "\"Global",
    "oproportion": "proportion",
    "bsome": "some",
    "obsit": "it",
    "bnoslanguages,": "languages,",
    "dwspeaking": "speaking",
    "unlike": "Unlike",
    "information.\"": "information.\"",
    "'we": "'we",
    "right.'\"": "right.'\"",
    "\"mode": "\"mode",
    "bos\"fruits": "\"fruits",
    "six": "six",
    "livy'": "Livy",
    "bfortunate,": "fortunate,",
    "'i'm": "'I'm",
    "head'.": "head'.",
    "bmelted": "melted",
    "foam,bgreatly": "foam, greatly",
}

ARTICLE_REPLACEMENTS: dict[str, tuple[tuple[str, str], ...]] = {
    "01a": (
        ("sanserif typefaces", "sans serif typefaces"),
        ("4, 000 employees", "4,000 employees"),
        ("7: 30 in the morning", "7:30 in the morning"),
        ("almost everything small external expectations", "almost everything — all external expectations"),
        ("these ni things", "these things"),
        ("with a bit more certainty that death was", "with a bit more certainty than when death was"),
        ("cleared away. I I", "cleared away. Sorry to be so dramatic, but it is quite true."),
    ),
    "01b": (
        ("tomorrow will bring 9W are", "tomorrow will bring are"),
        ("autumn OW night", "autumn night"),
        ("self- reliance", "self-reliance"),
        ("To those to those who", "To those who"),
        ("can and must do achieve tomorrow", "can and must achieve tomorrow"),
        ("tonight's about a woman", "tonight is about a woman"),
        ("Yes we can. zshoj w", "Yes we can."),
    ),
    "02a": (
        ("learn how to let blind", "learn how to let go."),
        ("we sustain losses grow in the process", "we sustain losses — and grow in the process"),
        ("ultimately, bAas the parable", "ultimately, as the parable"),
    ),
    "02b": (
        (
            "American nerves can't stand, and vice versa",
            "American nerves can stand a good many things that Chinese nerves cannot stand, and vice versa",
        ),
        ("under all beautiful trees", "under tall beautiful trees"),
        ("he cannot be different from Yen Huei", "he cannot be very different from Yen Huei"),
        ("see is that he is honest about it", "see is that he be honest about it"),
        ("merry philosophy of living. as", "merry philosophy of living."),
    ),
    "03a": (
        ("under pressure. now", "under pressure."),
        ("basketball, and (for tennis or track", "basketball, and (for some) tennis or track"),
        ("A Well-coordinated", "Well-coordinated"),
        (
            "players, groomed by country-club professionals, to suburban schools",
            "players, groomed by country-club professionals, went to suburban schools",
        ),
        ("conti- nued", "continued"),
        ("but a injury forced", "but a hip injury forced"),
        (
            "I tend almost completely to identify with, Defeat in athletics",
            "I tend almost completely to identify with, losers. Defeat in athletics",
        ),
    ),
    "03b": (
        (
            "whatever the challenges -political, social and economic -there is",
            "whatever the challenges — political, social and economic — there is",
        ),
        ("people everywhere. of it yd", "people everywhere."),
        ("accepting seconding best", "accepting second best"),
        ("the sixth and bn possibly", "the sixth and possibly"),
        ("prepared to do so\n", "prepared to do so.\n"),
        ("therefore self- discipline", "therefore self-discipline"),
        ("person I know. \"It is not", "person I know.\" It is not"),
    ),
    "04a": (
        ("in order to designate books. wan", "in order to designate books."),
        ("In other words, have invented libraries", "In other words, we have invented libraries"),
        ("as happened with old manuscripts The second invention", "as happened with old manuscripts. The second invention"),
    ),
    "04b": (
        ("examples of to such literary games", "examples of such literary games"),
        ("the marvellous person who Prince Andrej", "the marvellous person that Prince Andrej"),
        ("innumerable \"War and Peace\"., where", "innumerable \"War and Peace\", where"),
    ),
    "05a": (
        ("the first rule of the professional game Make", "the first rule of the professional game: Make"),
        ("as stolid as tax accounts in April", "as stolid as tax accountants in April"),
        ("celebration of Max 60th birthday", "celebration of Max Planck's 60th birthday"),
        ("peer- reviewed journal", "peer-reviewed journal"),
    ),
    "05b": (
        ("world. The world languages system", "world.\nThe world languages system"),
        ("currently lists almost 7, 000", "currently lists almost 7,000"),
        ("present century. English challenged", "present century.\nEnglish challenged"),
        ("some countries. LANGUAGES OF BUSINESS", "some countries.\nLANGUAGES OF BUSINESS"),
        (
            "significantly after 2010. to to MANDARIN AS A FOREIGN LANGUAGE I it",
            "significantly after 2010.\nMANDARIN AS A FOREIGN LANGUAGE",
        ),
        ("with the U. S. A. THE RISE OF SPANISH", "with the U. S. A.\nTHE RISE OF SPANISH"),
        ("on the islands. Languages trends", "on the islands.\nLanguages trends"),
    ),
    "06a": (
        ("an impossible situation", "in an impossible situation"),
        ("have the\nopposite effect.", "have the opposite effect."),
        ("opposite effect.\" 9 In any event", "opposite effect.\"\nIn any event"),
        ("information.\" 10 Nor", "information.\"\nNor"),
        ("right.'\" won", "right.'\""),
        ("as the handmaiden of colonialism\"", "as the \"handmaiden of colonialism\""),
        ("smacks a of exploitation", "smacks of exploitation"),
        ("situation,\"says", "situation,\" says"),
    ),
    "06b": (
        ("young and woold", "young and old"),
        ("sought, prestige", "sought prestige"),
        ("common learning experience \"", "common learning experience\""),
        ("so- called meritocracy", "so-called meritocracy"),
    ),
    "07a": (
        ("almost every am other physical property", "almost every other physical property"),
        ("complexity. wona", "complexity.\""),
        ("it has defused and dissipated", "it has diffused and dissipated"),
        ("gala- xies", "galaxies"),
        ("flute?\"Nothing", "flute?\" Nothing"),
        ("virtually nil. six", "virtually nil."),
        (
            "it would be likely -if I waited a year or so that at some point",
            "it would be likely — if I waited a year or so — that at some point",
        ),
        ("\"Irreversibility, \"said", "\"Irreversibility,\" said"),
    ),
    "07b": (
        ("the plague described, here", "the plague described here"),
        ("the fines of wines", "the finest of wines"),
        ("singing and ba celebrating", "singing and celebrating"),
        ("within the bm walls", "within the walls"),
        ("that almost one cared", "that almost no one cared"),
        ("visited each other they stayed far apart", "visited each other; they stayed far apart"),
        ("almost unbelievable -fathers", "almost unbelievable — fathers"),
    ),
    "08a": (
        ("Tiberius used Marco", "Tiberius used Macro"),
        ("For no agn man prospers", "For no man prospers"),
        ("there be not stonds nor restiveness", "there be not stops nor restiveness"),
        ("Homer'sverses", "Homer's verses"),
        ("willing mind. Of Fortune", "willing mind.\nOf Fortune"),
        (
            "The Spanish name dexterity readiness, partly expresses them",
            "The Spanish name, desemboltura, partly expresses them",
        ),
    ),
    "08b": (
        ("in the nature be of things", "in the nature of things"),
        ("might be taken up a under", "might be taken up under"),
        ("certain habit- patterns", "certain habit-patterns"),
        ("the co- operatives", "the co-operatives"),
        ("You could give examples", "You could all give examples"),
        ("one or two or three ahead the rank", "one or two or three ahead of the rank"),
        (
            "the psychologists call the attitude to be released",
            "the psychologists call intensifying the attitude to be released",
        ),
        ("point of view business depends", "point of view business success depends"),
        (
            "prepared-in-advance behavior pattern that is, in preparing",
            "prepared-in-advance behavior pattern — that is, in preparing",
        ),
    ),
    "09a": (
        ("allowing it to be abused.\n", "allowing it to be abused.\"\n"),
        ("\"is proven\n", "\"is proven false.\"\n"),
        ("roughly i percent", "roughly 10 percent"),
        (
            "continental ancestries,\" Marcus W. Feldman",
            "continental ancestries,\" said Marcus W. Feldman",
        ),
        ("explaining it better.\n", "explaining it better.\"\n"),
        ("discoveries in eld perspective", "discoveries in perspective"),
        ("freeing falsely convicted preventing disease", "freeing falsely convicted inmates, preventing disease"),
        ("Cambridge, Mass. living in America", "Cambridge, Mass. \"But living in America"),
        ("influence is very small. o or", "influence is very small.\""),
        (
            "African- American have lately been discussing out of genetic research until it's clear we're not going to use science to validate",
            "African-Americans have lately been discussing \"opting out of genetic research until it's clear we're not going to use science to validate prejudices.\"",
        ),
        ("their DNA,\"added", "their DNA,\" added"),
        ("how individuals be given", "how individuals can be given"),
        ("talents and limitations\".", "talents and limitations.\""),
        ("before the law,\"Perry", "before the law,\" Perry"),
        ("aren't real,\"Dr. Clark", "aren't real,\" Dr. Clark"),
        ("band marches by.\n", "band marches by.\"\n"),
        ("quantified by DNA. of", "quantified by DNA."),
        ("white culture', \"Dr. Richards", "white culture,' \" Dr. Richards"),
    ),
    "09b": (
        ("mental life Identical twins", "mental life. Identical twins"),
        ("can do is affecting its wiring", "can do is affect its wiring"),
        ("should auo not be allowed", "should not be allowed"),
        ("many of putative genes-for-X", "many of the putative genes-for-X"),
        ("are ai cobvious", "are obvious"),
        ("would have\nyou believe.", "would have you believe."),
        ("each child. 6 Finally", "each child.\nFinally"),
        ("in utero. 7 And still", "in utero.\nAnd still"),
        ("large behavioral effect - being identified", "large behavioral effect — being identified"),
        ("Beha- vioral genetics", "Behavioral genetics"),
    ),
    "10a": (
        ("Westborough swamp. qu", "Westborough swamp."),
        ("where or there are not factories", "where there are not factories"),
        ("who think I knew better than thou canst", "who think I know better than thou canst"),
        ("gazing wishfully meadow ward", "gazing wishfully meadowward"),
    ),
    "10b": (
        ("farewell to no my friend", "farewell to my friend"),
        ("a new world climate, plants", "a new world—climate, plants"),
        ("The Nevada is white of from", "The Nevada is white from"),
        ("striking on do the side", "striking on the side"),
        ("marvelous and no mysterious", "marvelous and more mysterious"),
    ),
}

HEADER_RE = re.compile(
    r"^(?:Unit\s+(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)|研\s*究\s*生\s*英\s*语\s*读\s*写\s*译\s*教\s*程)$",
    re.IGNORECASE,
)
PAGE_NUMBER_RE = re.compile(r"^[·.\s-]*\d{1,3}[·.\s-]*$")
PARAGRAPH_RE = re.compile(r"^(\d{1,3})[.)]?\s*(.*)$")


def word_text(word: dict) -> tuple[str, bool]:
    raw = str(word.get("text", "")).strip()
    confidence = float(word.get("confidence", 0))
    if re.search(r"[\u3400-\u9fff]", raw):
        return "", True
    fixed = TOKEN_FIXES.get(raw.casefold())
    if fixed is not None:
        return fixed, fixed != raw
    footnote_match = re.fullmatch(r"([A-Za-z][A-Za-z.'’-]*?)(\d{1,2})([,.;:]?)", raw)
    if footnote_match:
        return f"{footnote_match.group(1)}{footnote_match.group(3)}", True
    if confidence < WORD_CONFIDENCE:
        if raw.casefold() in LOW_CONFIDENCE_WORDS_TO_KEEP:
            return raw, False
        return "", True
    return raw, False


def normalized_line(line: dict) -> tuple[str, list[str]]:
    words = line.get("words", [])
    kept: list[str] = []
    dropped: list[str] = []
    for index, word in enumerate(words):
        text, changed = word_text(word)
        if changed and str(word.get("text", "")).strip():
            dropped.append(str(word["text"]).strip())
        if text:
            kept.append(text)
    text = " ".join(kept)
    text = re.sub(r"\s+([,.;:!?%)])", r"\1", text)
    text = re.sub(r"([($])\s+", r"\1", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text, dropped


def raw_line_text(line: dict) -> str:
    return str(line.get("text", "")).strip()


def extract_lines(ocr_dir: Path, article: Article) -> tuple[list[str], list[dict]]:
    collected: list[str] = []
    corrections: list[dict] = []
    started = False
    finished = False
    expected_paragraph = 1

    for image_no in range(article.start_image, article.end_image + 1):
        source_path = ocr_dir / f"graduate_{image_no}.json"
        payload = json.loads(source_path.read_text(encoding="utf-8"))
        for line_index, line in enumerate(payload.get("lines", [])):
            raw = raw_line_text(line)
            if not started:
                if raw.casefold() == f"text {article.text_label}".casefold():
                    started = True
                continue
            if raw.casefold() == article.end_marker.casefold():
                finished = True
                break

            text, dropped = normalized_line(line)
            raw_paragraph_match = PARAGRAPH_RE.match(raw)
            paragraph_number = int(raw_paragraph_match.group(1)) if raw_paragraph_match else None
            is_paragraph_marker = bool(
                paragraph_number is not None
                and (
                    (not collected and paragraph_number == 1)
                    or (collected and expected_paragraph <= paragraph_number <= expected_paragraph + 4)
                )
            )
            if is_paragraph_marker:
                normalized_match = PARAGRAPH_RE.match(text)
                if not normalized_match or int(normalized_match.group(1)) != paragraph_number:
                    text = f"{paragraph_number} {text}".strip()
            if dropped:
                corrections.append({
                    "image": f"graduate_{image_no}.jpg",
                    "line": line_index,
                    "raw": raw,
                    "droppedOrCorrected": dropped,
                    "result": text,
                })
            if (
                not text
                or HEADER_RE.fullmatch(text)
                or (PAGE_NUMBER_RE.fullmatch(text) and not is_paragraph_marker)
            ):
                continue

            paragraph_match = PARAGRAPH_RE.match(text)
            if not collected:
                if not paragraph_match or int(paragraph_match.group(1)) != 1:
                    continue
                text = paragraph_match.group(2).strip() or "\n"
                expected_paragraph = 2
            elif paragraph_match:
                number = int(paragraph_match.group(1))
                if expected_paragraph <= number <= expected_paragraph + 4:
                    text = f"\n{paragraph_match.group(2).strip()}"
                    expected_paragraph = number + 1
                elif not paragraph_match.group(2):
                    continue
            if text:
                collected.append(text)
        if finished:
            break

    if not started:
        raise ValueError(f"{article.title}: TEXT {article.text_label} marker not found")
    if not finished:
        raise ValueError(f"{article.title}: end marker {article.end_marker!r} not found")
    if not collected:
        raise ValueError(f"{article.title}: no body text extracted")
    return collected, corrections


def join_paragraphs(lines: list[str]) -> list[str]:
    paragraphs: list[str] = []
    current: list[str] = []
    for line in lines:
        if line.startswith("\n"):
            if current:
                paragraphs.append(" ".join(current).strip())
            current = [line.lstrip()]
        else:
            current.append(line)
    if current:
        paragraphs.append(" ".join(current).strip())
    return [paragraph for paragraph in paragraphs if paragraph]


def correct_article(article: Article, paragraphs: list[str]) -> list[str]:
    corrected = "\n".join(paragraphs)
    for old, new in ARTICLE_REPLACEMENTS.get(article.slug, ()):
        if old not in corrected:
            raise ValueError(f"{article.slug}: expected OCR fragment not found: {old!r}")
        corrected = corrected.replace(old, new)
    return corrected.splitlines()


def parse_graduate_reader(ocr_dir: Path) -> tuple[list[dict], list[dict]]:
    lessons: list[dict] = []
    corrections: list[dict] = []
    for article in ARTICLES:
        lines, article_corrections = extract_lines(ocr_dir, article)
        paragraphs = correct_article(article, join_paragraphs(lines))
        blocks = [{"type": "paragraph", "lang": "en", "text": paragraph} for paragraph in paragraphs]
        lesson_id = f"{VOLUME_ID}-{article.slug}"
        json_path = f"postgraduate/lessons/{VOLUME_ID}/{article.slug}.json"
        lessons.append({
            "schemaVersion": 1,
            "id": lesson_id,
            "volumeId": VOLUME_ID,
            "unitNo": article.unit_no,
            "articleNo": article.article_no,
            "textLabel": f"Text {article.text_label}",
            "title": article.title,
            "theme": f"{UNIT_NAMES[article.unit_no]} · Text {article.text_label}",
            "author": article.author,
            "jsonPath": json_path,
            "text": "\n".join(paragraph["text"] for paragraph in blocks),
            "blocks": blocks,
            "source": {
                "book": "研究生英语读写译教程（第二版）",
                "editor": "李知宇",
                "publisher": "暨南大学出版社",
                "isbn": "978-7-5668-0336-8",
                "images": [
                    f"tools/graduate/graduate_{image_no}.jpg"
                    for image_no in range(article.start_image, article.end_image + 1)
                ],
                "ocr": "Windows 11 OneOCR",
            },
        })
        corrections.extend(
            {"lessonId": lesson_id, **correction}
            for correction in article_corrections
        )
    return lessons, corrections
