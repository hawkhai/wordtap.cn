"""Preserve explicit bullet lists in reviewed textbook paragraphs."""


def paragraph_block(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    is_list = bool(lines) and all(line.startswith('• ') for line in lines)
    return {'type': 'list' if is_list else 'paragraph', 'lang': 'en', 'text': text}
