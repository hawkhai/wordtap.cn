# College English 逐篇全文校对计划

## 唯一目录基线

- 只以四册 PDF 第 15–16 页的 `Map of the book` 为目录依据。
- 每册 6 个单元，每单元只收录 Text A、Text B、Stories of China，共 72 篇。
- Preview、词表、练习、Structure analysis and writing、Reading skills、Unit project、封面、前言和目录都不是文章。
- 原图逐页核实后采用“PDF/OCR 页 = 印刷页 + 15”的映射（例如原图 19 为印刷第 4 页）；逐篇校对时仍须复核实际文章边界。

## 不可替代的全文校对

- 一次只处理台账中最早的未通过文章；当前篇未通过前不得签下一篇。
- 必须打开 PDF 原页或对应原图，逐行对照 OCR；抽样、正则、置信度和构建成功都不能代替全文阅读。
- 逐篇核对标题、册次、Unit、Section、开头、结尾、跨页顺序、分栏、文本框、专名、数字、标点、断词和连字符。
- 删除页眉页脚、页码、教学指令、题目、答案、词表和相邻栏目，不得凭语言习惯改写教材原文。
- 修订后必须从头到尾重新阅读最终文章，再记录签字事件。

## 状态和签字

状态只允许按以下路径推进：

`pending → in_review → needs_fix → recheck → passed`

- 初始化程序只能创建 `pending`，不得填写签字者或 `passed`。
- `passed` 必须有独立文章 JSON、全文 SHA-256、来源 PDF 页、OCR 原图/JSON 证据、签字者和时间。
- 按已确认政策，Codex 可以进行全文视觉校对并签字，但必须如实记录 `reviewer=Codex`，不冒充真人。
- 所有文章单签。OCR 风险只记录工作量和关注点，不构成通过依据。

## 文件和留痕

- `article-catalog.json`：从教材目录转录的 72 篇不可变基线。
- `manual-review-ledger.tsv`：一篇一行的当前状态。
- `manual-review-events.jsonl`：追加式状态事件和哈希链。
- `source-page-audit.tsv`：728 个 PDF 页的 OCR 覆盖和文章/非文章归类。
- `reviewed-articles/<article-id>.json`：逐篇校对后的最终正文。

每个事件记录前后文本哈希、来源 PDF 哈希、证据、时间、签字者、前一事件哈希和本事件哈希。旧事件不得重写。

## 发布规则

- 旧的 724 条页面课文全部退出公开数据。
- 公开 manifest 只接受从第一篇开始连续通过的文章前缀。
- 每篇签字后运行应用与验证命令，逐篇恢复发布。
- 完整验收要求 72 篇全部 `passed`；普通验证允许未完成，但绝不允许跳篇发布。
