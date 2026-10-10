#!/usr/bin/env python3
"""
新概念英语 LRC 转 Markdown 生成器
从 LRC 文件中提取课文内容，生成 Markdown 文件和索引页面
"""

import os
import re
from pathlib import Path

# 书籍配置
BOOKS = [
    {
        "id": "nce1",
        "title": "新概念英语 第一册",
        "subtitle": "英语初阶 (First Things First)",
        "dir": "新概念英语第1册美音（MP3+LRC）",
        "lrc_dir": "NCE1-美音-(MP3+LRC)",
        "desc": "英语基础，适合初学者",
    },
    {
        "id": "nce2",
        "title": "新概念英语 第二册",
        "subtitle": "实践与进步 (Practice and Progress)",
        "dir": "新概念英语第2册美音（MP3+LRC）",
        "lrc_dir": "NCE2-美音-(MP3+LRC)",
        "desc": "构建英语基础的关键阶段",
    },
    {
        "id": "nce3",
        "title": "新概念英语 第三册",
        "subtitle": "培养技能 (Developing Skills)",
        "dir": "新概念英语第3册美音（MP3+LRC）",
        "lrc_dir": "NCE3-美音-(MP3+LRC)",
        "desc": "提升英语综合能力",
    },
    {
        "id": "nce4",
        "title": "新概念英语 第四册",
        "subtitle": "流利英语 (Fluency in English)",
        "dir": "新概念英语第4册美音（MP3+LRC）",
        "lrc_dir": "NCE4-美音-(MP3+LRC)",
        "desc": "高级英语，流利表达",
    },
]


def parse_lrc(lrc_path: str) -> dict:
    """解析 LRC 文件，提取元数据和带时间戳的歌词"""
    metadata = {}
    lyrics = []

    with open(lrc_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            # 解析元数据标签
            meta_match = re.match(r"\[(\w+):(.*)\]", line)
            if meta_match:
                tag, value = meta_match.groups()
                if tag in ("al", "ar", "ti", "by"):
                    metadata[tag] = value
                    continue

            # 解析带时间戳的歌词行
            time_match = re.match(r"\[(\d{2}):(\d{2}\.\d{2})\](.*)", line)
            if time_match:
                minutes, seconds, text = time_match.groups()
                timestamp = float(minutes) * 60 + float(seconds)
                if text.strip():
                    lyrics.append(
                        {"timestamp": timestamp, "text": text.strip()}
                    )

    return {"metadata": metadata, "lyrics": lyrics}


def extract_lesson_content(lyrics: list, metadata: dict) -> tuple:
    """从歌词中提取课文内容，分离标题/问题和正文"""
    title_lines = []
    content_lines = []
    question = None

    has_lesson_header = False
    if lyrics and lyrics[0]["text"].startswith("Lesson"):
        has_lesson_header = True

    for i, item in enumerate(lyrics):
        text = item["text"]

        # 第一行是 Lesson X (NCE1/3/4)
        if i == 0 and text.startswith("Lesson"):
            title_lines.append(text)
            continue

        # 第二行通常是课文标题 (有 Lesson header 的情况)
        if has_lesson_header and i == 1 and not text.startswith("Listen"):
            title_lines.append(text)
            continue

        # "Listen to the tape..." 是提示语
        if text.startswith("Listen to the tape"):
            continue

        # 问句（问题）通常在提示语之后
        if question is None and text.endswith("?"):
            question = text
            continue

        # 其余是正文
        content_lines.append(text)

    # 如果没有提取到标题，使用 metadata 中的标题
    if not title_lines and metadata.get("ti"):
        title_lines.append(metadata["ti"])

    return title_lines, question, content_lines


def generate_lesson_markdown(book: dict, lesson_num: int, lrc_data: dict) -> str:
    """生成单篇课文的 Markdown 内容"""
    title_lines, question, content_lines = extract_lesson_content(
        lrc_data["lyrics"], lrc_data["metadata"]
    )

    # 获取课文标题
    lesson_title = ""
    if len(title_lines) >= 2:
        lesson_title = title_lines[1]
    elif lrc_data["metadata"].get("ti"):
        lesson_title = lrc_data["metadata"]["ti"]

    # 构建 Markdown
    md = f"# {book['title']} - Lesson {lesson_num}\n\n"
    md += f"## {lesson_title}\n\n"

    if question:
        md += f"> **问题**: {question}\n\n"
        md += "---\n\n"

    md += "## 课文\n\n"
    for line in content_lines:
        md += f"{line}\n\n"

    # 添加音频引用
    md += "---\n\n"
    md += "## 音频\n\n"
    md += f"配套音频文件: `{lrc_data['filename']}.mp3`\n\n"

    return md, lesson_title


def generate_index_html(books_data: dict) -> str:
    """生成带二级导航的索引 HTML 页面"""
    html = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>新概念英语学习笔记</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        header {
            text-align: center;
            color: white;
            padding: 40px 20px;
        }
        header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        header p {
            font-size: 1.2em;
            opacity: 0.9;
        }
        .books-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            padding: 20px 0;
        }
        .book-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .book-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.3);
        }
        .book-header {
            padding: 20px;
            color: white;
            cursor: pointer;
        }
        .book-header.nce1 { background: linear-gradient(135deg, #FF6B6B, #FF8E53); }
        .book-header.nce2 { background: linear-gradient(135deg, #4ECDC4, #44B09E); }
        .book-header.nce3 { background: linear-gradient(135deg, #667eea, #764ba2); }
        .book-header.nce4 { background: linear-gradient(135deg, #f093fb, #f5576c); }
        .book-header h2 {
            font-size: 1.4em;
            margin-bottom: 5px;
        }
        .book-header .subtitle {
            font-size: 0.9em;
            opacity: 0.9;
        }
        .book-header .desc {
            font-size: 0.85em;
            opacity: 0.8;
            margin-top: 5px;
        }
        .book-header .count {
            display: inline-block;
            background: rgba(255,255,255,0.3);
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 0.85em;
            margin-top: 8px;
        }
        .lessons-list {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.4s ease;
            background: #f8f9fa;
        }
        .lessons-list.active {
            max-height: 2000px;
        }
        .lessons-list ul {
            list-style: none;
            padding: 10px 20px 20px;
        }
        .lessons-list li {
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .lessons-list li:last-child {
            border-bottom: none;
        }
        .lessons-list a {
            color: #333;
            text-decoration: none;
            display: flex;
            align-items: center;
            transition: color 0.2s;
        }
        .lessons-list a:hover {
            color: #667eea;
        }
        .lessons-list .lesson-num {
            display: inline-block;
            width: 60px;
            font-weight: bold;
            color: #667eea;
        }
        .lessons-list .lesson-title {
            flex: 1;
        }
        .lessons-list .arrow {
            opacity: 0;
            transition: opacity 0.2s;
        }
        .lessons-list a:hover .arrow {
            opacity: 1;
        }
        .toggle-icon {
            float: right;
            transition: transform 0.3s;
        }
        .book-header.expanded .toggle-icon {
            transform: rotate(180deg);
        }
        footer {
            text-align: center;
            color: white;
            padding: 30px;
            opacity: 0.8;
        }
        @media (max-width: 768px) {
            header h1 { font-size: 1.8em; }
            .books-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📚 新概念英语学习笔记</h1>
            <p>New Concept English Study Notes</p>
        </header>
        <div class="books-grid">
"""

    for book_id, data in books_data.items():
        book = data["book"]
        lessons = data["lessons"]
        html += f"""
            <div class="book-card">
                <div class="book-header {book_id}" onclick="toggleLessons('{book_id}')">
                    <h2>{book['title']}</h2>
                    <div class="subtitle">{book['subtitle']}</div>
                    <div class="desc">{book['desc']}</div>
                    <span class="count">{len(lessons)} 课</span>
                    <span class="toggle-icon">▼</span>
                </div>
                <div class="lessons-list" id="{book_id}-lessons">
                    <ul>
"""
        for lesson in lessons:
            md_filename = f"{book_id}/lesson-{lesson['num']:03d}.md"
            html += f"""
                        <li>
                            <a href="{md_filename}">
                                <span class="lesson-num">Lesson {lesson['num']}</span>
                                <span class="lesson-title">{lesson['title']}</span>
                                <span class="arrow">→</span>
                            </a>
                        </li>
"""
        html += """
                    </ul>
                </div>
            </div>
"""

    html += """
        </div>
        <footer>
            <p>Generated from LRC files | New Concept English</p>
        </footer>
    </div>
    <script>
        function toggleLessons(bookId) {
            const lessonsList = document.getElementById(bookId + '-lessons');
            const header = lessonsList.previousElementSibling;
            lessonsList.classList.toggle('active');
            header.classList.toggle('expanded');
        }
        // 默认展开第一册
        document.addEventListener('DOMContentLoaded', function() {
            toggleLessons('nce1');
        });
    </script>
</body>
</html>
"""
    return html


def generate_readme_md(books_data: dict) -> str:
    """生成 README.md 索引文件"""
    md = """# 📚 新概念英语学习笔记

> New Concept English Study Notes
>
> 从 LRC 字幕文件自动生成的课文笔记

---

## 目录

"""

    for book_id, data in books_data.items():
        book = data["book"]
        lessons = data["lessons"]
        md += f"### [{book['title']}]({book_id}/index.md)\n"
        md += f"*{book['subtitle']}*\n\n"
        md += f"共 {len(lessons)} 课\n\n"

    md += """---

## 使用说明

1. 点击上方链接进入对应册的目录
2. 选择课文开始学习
3. 每篇课文包含：
   - 课文标题
   - 听力问题
   - 课文正文
   - 配套音频文件名

## 音频文件

配套音频文件位于对应的 `MP3+LRC` 目录中。

---

*自动生成于 LRC 字幕文件*
"""
    return md


def generate_book_index(book: dict, lessons: list) -> str:
    """生成单册的索引 Markdown"""
    md = f"# {book['title']}\n\n"
    md += f"**{book['subtitle']}**\n\n"
    md += f"{book['desc']}\n\n"
    md += f"共 {len(lessons)} 课\n\n"
    md += "---\n\n"
    md += "## 课文目录\n\n"

    for lesson in lessons:
        md += f"- [Lesson {lesson['num']}: {lesson['title']}](lesson-{lesson['num']:03d}.md)\n"

    md += "\n---\n\n"
    md += f"[返回首页](../index.md)\n"

    return md


def process_book(base_dir: str, book: dict) -> dict:
    """处理单册书籍，返回课程数据"""
    lrc_dir = os.path.join(base_dir, book["dir"], book["lrc_dir"])
    output_dir = os.path.join(base_dir, "md_output", book["id"])

    # 创建输出目录
    os.makedirs(output_dir, exist_ok=True)

    lessons = []

    # 获取所有 LRC 文件并排序
    lrc_files = sorted(
        [f for f in os.listdir(lrc_dir) if f.endswith(".lrc")]
    )

    for lrc_file in lrc_files:
        lrc_path = os.path.join(lrc_dir, lrc_file)

        # 从文件名提取课程编号
        filename = os.path.splitext(lrc_file)[0]
        num_match = re.match(r"(\d+)", filename)
        if num_match:
            lesson_num = int(num_match.group(1))
        else:
            continue

        # 解析 LRC 文件
        lrc_data = parse_lrc(lrc_path)
        lrc_data["filename"] = filename

        # 生成 Markdown
        md_content, lesson_title = generate_lesson_markdown(
            book, lesson_num, lrc_data
        )

        # 写入文件
        md_filename = f"lesson-{lesson_num:03d}.md"
        md_path = os.path.join(output_dir, md_filename)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)

        lessons.append({"num": lesson_num, "title": lesson_title})

        print(f"  [OK] Lesson {lesson_num}: {lesson_title}")

    # 生成册索引
    index_md = generate_book_index(book, lessons)
    index_path = os.path.join(output_dir, "index.md")
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(index_md)

    return {"book": book, "lessons": lessons}


def main():
    """主函数"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    print("[NCE] 新概念英语 LRC 转 Markdown 生成器")
    print("=" * 50)

    books_data = {}

    for book in BOOKS:
        print(f"\n[BOOK] 处理: {book['title']}")
        print("-" * 40)
        result = process_book(base_dir, book)
        books_data[book["id"]] = result
        print(f"  共 {len(result['lessons'])} 课")

    # 生成主页索引
    print("\n[INDEX] 生成索引文件...")
    output_base = os.path.join(base_dir, "md_output")

    # HTML 索引
    html_content = generate_index_html(books_data)
    html_path = os.path.join(output_base, "index.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"  [OK] {html_path}")

    # Markdown 索引
    md_content = generate_readme_md(books_data)
    md_path = os.path.join(output_base, "index.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    print(f"  [OK] {md_path}")

    print("\n" + "=" * 50)
    print("[DONE] 完成！")
    print(f"\n输出目录: {output_base}")
    print(f"HTML 索引: {html_path}")
    print(f"Markdown 索引: {md_path}")


if __name__ == "__main__":
    main()
