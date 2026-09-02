# 考研英语资料来源与补充指南

## 当前归档

`raw/` 中保留以下原始资料：

- `english-1.zip`：英语一真题压缩包及解压目录。
- `english-2.zip`：英语二真题压缩包及解压目录。
- `english-2-2010-2016.pdf`：用于替换原压缩包中乱码文本层的英语二合订本。
- `source-files.json`：全部原始文件的相对路径、大小和 SHA-256。
- `source-manifest.json`：16 项顶层下载源的来源页、直接下载 URL、大小和 SHA-256。

## 来源

### SWJTU Hub

- 来源页：https://swjtuhub.cn/考研资料/英语/
- 英语一 ZIP：https://raw.githubusercontent.com/swjtuhub/SWJTU-Courses/main/考研资料/英语/真题/英语一真题.zip
- 英语二 ZIP：https://raw.githubusercontent.com/swjtuhub/SWJTU-Courses/main/考研资料/英语/真题/英语二真题.zip

原始 SWJTU 包用于英语一 1980–2020、英语二 2010–2019。

### 懒笔记英语考试资料库

- 课程入口：https://english-exam.lazynote.cn/kaoyan/
- 使用范围：英语一 2021–2026、英语二 2020–2026。
- 每年来源页形式：`https://english-exam.lazynote.cn/kaoyan/paper/YYYY-english-one/` 或 `YYYY-english-two/`。
- 只下载“真题（整卷）”PDF，不使用答案解析版；原始文件保存在 `raw/recent/`。

当前完整生成范围：英语一 1980–2026，共 47 份；英语二 2010–2026，共 17 份。

#### 逐年下载清单

“来源页”用于人工核对试卷年份、题型和下载按钮；“整卷 PDF”是生成脚本实际使用的直接下载地址。大小为本次归档文件的实际字节数。

| 年份 | 类别 | 来源页 | 整卷 PDF | 本地文件 | 字节数 | SHA-256 |
| --- | --- | --- | --- | --- | ---: | --- |
| 2021 | 英语一 | [查看](https://english-exam.lazynote.cn/kaoyan/paper/2021-english-one/) | [下载](https://english-exam.lazynote.cn/downloads/kaoyan/2021-english-one/%E8%80%83%E7%A0%94%E8%8B%B1%E8%AF%AD%E4%B8%802021%E5%B9%B4%E7%9C%9F%E9%A2%98%EF%BC%88%E6%95%B4%E5%8D%B7%EF%BC%89.pdf) | `raw/recent/e1-2021.pdf` | 201195 | `f71c2b924bc8e830309b6d4b3c78ff1b369ce27d05b32098993a57f86bee874b` |
| 2022 | 英语一 | [查看](https://english-exam.lazynote.cn/kaoyan/paper/2022-english-one/) | [下载](https://english-exam.lazynote.cn/downloads/kaoyan/2022-english-one/%E8%80%83%E7%A0%94%E8%8B%B1%E8%AF%AD%E4%B8%802022%E5%B9%B4%E7%9C%9F%E9%A2%98%EF%BC%88%E6%95%B4%E5%8D%B7%EF%BC%89.pdf) | `raw/recent/e1-2022.pdf` | 202382 | `d6032d5272d1cb20eca7905a68f5f5f8b1d37c59025b3473b53ab497507adaa0` |
| 2023 | 英语一 | [查看](https://english-exam.lazynote.cn/kaoyan/paper/2023-english-one/) | [下载](https://english-exam.lazynote.cn/downloads/kaoyan/2023-english-one/%E8%80%83%E7%A0%94%E8%8B%B1%E8%AF%AD%E4%B8%802023%E5%B9%B4%E7%9C%9F%E9%A2%98%EF%BC%88%E6%95%B4%E5%8D%B7%EF%BC%89.pdf) | `raw/recent/e1-2023.pdf` | 164935 | `85f717979c397d82e877dedb93f9d5dc782449ab286354c35a83c8d916880843` |
| 2024 | 英语一 | [查看](https://english-exam.lazynote.cn/kaoyan/paper/2024-english-one/) | [下载](https://english-exam.lazynote.cn/downloads/kaoyan/2024-english-one/%E8%80%83%E7%A0%94%E8%8B%B1%E8%AF%AD%E4%B8%802024%E5%B9%B4%E7%9C%9F%E9%A2%98%EF%BC%88%E6%95%B4%E5%8D%B7%EF%BC%89.pdf) | `raw/recent/e1-2024.pdf` | 201579 | `a59fe801378dc19f9c589e918ad3c41f29ee67f3036e5cc27056b97f6926de1c` |
| 2025 | 英语一 | [查看](https://english-exam.lazynote.cn/kaoyan/paper/2025-english-one/) | [下载](https://english-exam.lazynote.cn/downloads/kaoyan/2025-english-one/%E8%80%83%E7%A0%94%E8%8B%B1%E8%AF%AD%E4%B8%802025%E5%B9%B4%E7%9C%9F%E9%A2%98%EF%BC%88%E6%95%B4%E5%8D%B7%EF%BC%89.pdf) | `raw/recent/e1-2025.pdf` | 167646 | `e8f0910dfd60d27ba28fb4a8c7354ee732107651a03922f9520a609384c94879` |
| 2026 | 英语一 | [查看](https://english-exam.lazynote.cn/kaoyan/paper/2026-english-one/) | [下载](https://english-exam.lazynote.cn/downloads/kaoyan/2026-english-one/%E8%80%83%E7%A0%94%E8%8B%B1%E8%AF%AD%E4%B8%802026%E5%B9%B4%E7%9C%9F%E9%A2%98%EF%BC%88%E6%95%B4%E5%8D%B7%EF%BC%89.pdf) | `raw/recent/e1-2026.pdf` | 166303 | `891547f4773ac4f9bd53140c27cfc772127d55ca8893e591b8fcc48dc6285b21` |
| 2020 | 英语二 | [查看](https://english-exam.lazynote.cn/kaoyan/paper/2020-english-two/) | [下载](https://english-exam.lazynote.cn/downloads/kaoyan/2020-english-two/%E8%80%83%E7%A0%94%E8%8B%B1%E8%AF%AD%E4%BA%8C2020%E5%B9%B4%E7%9C%9F%E9%A2%98%EF%BC%88%E6%95%B4%E5%8D%B7%EF%BC%89.pdf) | `raw/recent/e2-2020.pdf` | 197498 | `d2d9a81eab271f6ac1540a75ba216a9b684ddfe66154791d1875c19248424a19` |
| 2021 | 英语二 | [查看](https://english-exam.lazynote.cn/kaoyan/paper/2021-english-two/) | [下载](https://english-exam.lazynote.cn/downloads/kaoyan/2021-english-two/%E8%80%83%E7%A0%94%E8%8B%B1%E8%AF%AD%E4%BA%8C2021%E5%B9%B4%E7%9C%9F%E9%A2%98%EF%BC%88%E6%95%B4%E5%8D%B7%EF%BC%89.pdf) | `raw/recent/e2-2021.pdf` | 197881 | `f1ee5e2cd73d9dbe464906129b91cff9eb62e5e1ad5738bd3d6dfc62891f1b16` |
| 2022 | 英语二 | [查看](https://english-exam.lazynote.cn/kaoyan/paper/2022-english-two/) | [下载](https://english-exam.lazynote.cn/downloads/kaoyan/2022-english-two/%E8%80%83%E7%A0%94%E8%8B%B1%E8%AF%AD%E4%BA%8C2022%E5%B9%B4%E7%9C%9F%E9%A2%98%EF%BC%88%E6%95%B4%E5%8D%B7%EF%BC%89.pdf) | `raw/recent/e2-2022.pdf` | 196749 | `b1b7efe9af2a37a06cab8854cb14f618fcbba726613c3001278543ebd55bb2cb` |
| 2023 | 英语二 | [查看](https://english-exam.lazynote.cn/kaoyan/paper/2023-english-two/) | [下载](https://english-exam.lazynote.cn/downloads/kaoyan/2023-english-two/%E8%80%83%E7%A0%94%E8%8B%B1%E8%AF%AD%E4%BA%8C2023%E5%B9%B4%E7%9C%9F%E9%A2%98%EF%BC%88%E6%95%B4%E5%8D%B7%EF%BC%89.pdf) | `raw/recent/e2-2023.pdf` | 163184 | `62c1dab8dbd8d9bbec9c39b0f7a88276c0a9a99b424c24a30de0e07b867bb619` |
| 2024 | 英语二 | [查看](https://english-exam.lazynote.cn/kaoyan/paper/2024-english-two/) | [下载](https://english-exam.lazynote.cn/downloads/kaoyan/2024-english-two/%E8%80%83%E7%A0%94%E8%8B%B1%E8%AF%AD%E4%BA%8C2024%E5%B9%B4%E7%9C%9F%E9%A2%98%EF%BC%88%E6%95%B4%E5%8D%B7%EF%BC%89.pdf) | `raw/recent/e2-2024.pdf` | 161918 | `6ddbe204a4c67319feab5befa21dbc819baa57ddcf31bdf8746be6698625f1e7` |
| 2025 | 英语二 | [查看](https://english-exam.lazynote.cn/kaoyan/paper/2025-english-two/) | [下载](https://english-exam.lazynote.cn/downloads/kaoyan/2025-english-two/%E8%80%83%E7%A0%94%E8%8B%B1%E8%AF%AD%E4%BA%8C2025%E5%B9%B4%E7%9C%9F%E9%A2%98%EF%BC%88%E6%95%B4%E5%8D%B7%EF%BC%89.pdf) | `raw/recent/e2-2025.pdf` | 197799 | `ee7794c69789029c86fde6a1f16da952752dd5a7d4c5f2972370d3e430ca32e5` |
| 2026 | 英语二 | [查看](https://english-exam.lazynote.cn/kaoyan/paper/2026-english-two/) | [下载](https://english-exam.lazynote.cn/downloads/kaoyan/2026-english-two/%E8%80%83%E7%A0%94%E8%8B%B1%E8%AF%AD%E4%BA%8C2026%E5%B9%B4%E7%9C%9F%E9%A2%98%EF%BC%88%E6%95%B4%E5%8D%B7%EF%BC%89.pdf) | `raw/recent/e2-2026.pdf` | 162097 | `6cc19f340e759df4fc56a816db8296a9212d8e26e84e2b055dc5ea36f8b34b04` |

考试年份按试卷标注和招生年份记录。例如“2026 考研英语”通常在 2025 年 12 月举行，但课程 ID 和文件名仍使用 `2026`。

下载器中的 URL 由年份和类别生成；重新运行 `npm run fetch:kaoyan-english` 会保留有效本地文件，只补缺失文件，并重新生成 `source-manifest.json`。

### 北地论坛英语二替代合订本

- 来源页：https://bjcugb.com/forum.php?mod=viewthread&tid=8127
- 用途：SWJTU 英语二 2010–2016 部分 PDF 的文本编码不可可靠提取，因此使用该公开合订 PDF 的可检索文本层。
- 精确下载地址及 SHA-256 见 `source-manifest.json`。

## 后续补充

1. 运行 `npm run fetch:kaoyan-english`。脚本会验证 ZIP/PDF 文件头、重新解包，并更新顶层来源清单。
2. 新年份 PDF 放入相应的 `raw/english-1/` 或 `raw/english-2/` 目录；同时在生成脚本中登记选取规则和来源 ID。
3. 运行 `npm run inventory:course-sources` 更新全文件清单。
4. 运行 `npm run generate:kaoyan-english`、`npm run verify:kaoyan-english` 和 `npm run build`。

稳定 ID 为 `e1-YYYY` / `e2-YYYY`，短码为 `ky:e1-YYYY` / `ky:e2-YYYY`。新年份只追加新 ID，不会改变旧短码。
