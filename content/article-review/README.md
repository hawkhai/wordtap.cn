# 文章审核记录

当前 JSON 句段审核覆盖 **1054 篇**，全部已通读并复核：561 篇已修改通过、373 篇无修改通过、120 篇待确认，待审为 0。677 篇实际调整了句段（包含做了部分修复、仍有遗留问题的文章）。待确认未清零，完整验收仍不通过。

本站发布数据于 2026-10-07 从源仓库提交 [be2d7639](https://github.com/hawkhai/english_word_study_web/commit/be2d7639d70ab54f9bb1c144a2ec67453e0530ad) 对应工作区同步，1054 篇及 7 份课程目录与源工作区逐字节一致；与源提交的差异仅限部分文件的 Git LF 行尾规范化。同步范围和验证结果见 [sync-2026-10-07.json](sync-2026-10-07.json)；上一轮同步记录仅作历史追溯。

本站 `prebuild` 校验发布快照、恢复链和本轮句段台账的完整性，允许如实记录的待确认项，不代表完整审核验收。`npm run verify:segmentation:complete` 与既有 `npm run verify:article-review:published` 保留严格通过要求；120 篇待确认未解决时均应失败。同步未重新读取原教材或重建课程数据。

直接查看 [当前进度和剩余问题](segmentation/progress.md)、[逐篇台账](segmentation/ledger.tsv)、[检查结果](segmentation/verification.json)。本轮只依据现有 JSON，不读取原教材或图片，不改写字词；字幕、时间轴、课程身份和资源链接保持不变。

## 保留的文件

|位置|用途|
|---|---|
|`segmentation/`|本轮逐篇决定、前后哈希、上下文理由、复核状态和剩余问题|
|`revisions/`、`ledger.tsv`、`events.jsonl`|当前修订、发布记录和连续事件链；生成器只重放精确匹配的修订|
|`history.zip`|校验仍依赖的历史修订，按原 JSON 字节无损压缩；条目名为修订哈希|
|`cleanup-2026-10-06.json`|撤回擅自增补与改写的冻结恢复报告，不能重新格式化或改写|
|`generator-baselines/`|生成源与发布基线的精确对应证明，防止模糊重放|
|`source-evidence/`、`source-history/`|已引用的来源定位和旧签名源快照|
|`source-baselines/`、`source-recovery.json`|研究生课程六份源稿恢复记录，供既有生成流程使用|
|`review-note-errata.json`|历史审校备注的纠错记录|

历史修订不是新的全文审核。`source-fidelity-rules-v1` 是恢复规则记录，`json-segmentation-v1` 是本轮句段审核；不能将历史通过状态当作本轮通过。大学英语仍受自身签名链约束。

## 历史清理（2026-10-07）

移除已被当前结果取代的阶段检查点、旧构建/浏览器日志、旧验收汇总及未被引用的地图文件。旧状态和删除的文件可从源仓库 Git 提交 [4a51efb9](https://github.com/hawkhai/english_word_study_web/commit/4a51efb94f8bb63765b1c82c6139a6b2679dab3d) 找回；不再把过期的“全部通过”声明放在当前目录中。

1958 份历史修订仍被事件链和恢复检查引用，合并为 `history.zip`，不丢弃必要证据。原引用 `content/article-review/history/<sha256>.json` 作为逻辑地址保留；审核工具直接读取对应 ZIP 条目，无需解压。文件原始字节、来源 SHA256、修订哈希与事件链不变。缺失、篡改或重复条目仍然导致校验失败。

新审核可以继续写入少量 `history/*.json`。需要再次整理时运行 `python tools/review_archive.py --compact`：工具验证所有修订哈希和压缩前后逐字节一致后才删除散文件；重复执行结果相同。详细清理数量和验证结果见 [storage-cleanup.json](storage-cleanup.json)。清理只改变证据存放方式，不改变课文或审核结论，也不重写 Git 历史。

## 检查与后续审核

```powershell
python tools/review-segmentation.py check
python tools/review-articles.py verify-published
python tools/cleanup-articles.py check
python -m unittest discover -s tools -p test_review_archive.py
python -m unittest discover -s tools -p test_article_review.py
python -m unittest discover -s tools -p test_segmentation_review.py
python -m unittest discover -s tools -p test_article_cleanup.py
```

这些检查只使用发布 JSON、已有审核证据和恢复报告。`python tools/review-segmentation.py check --require-complete` 在仍有待确认记录时必须失败。不要用 `verify --require-complete` 冒充 JSON 检查：它是旧的原始来源复查入口，会读取原始来源。

逐篇初始化、扫描、登记、复审和边界操作格式见 [句段审核说明](segmentation/README.md)。机器候选不能自动标记通读通过；JSON 变化会使原审核失效。新概念只允许调整阅读字段的边界，大学英语不能绕过既有签名源稿流程发布。
