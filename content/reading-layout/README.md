# 点词阅读排版审核台账

`manual-review-ledger.tsv` 覆盖 `public/**/lessons/*.json` 的每一篇课程内容。它把机器检查与人工复核分开：

当前范围是 1054 个会进入“点词阅读”的 lesson JSON。`public` 里的字典分片、manifest 和下载元数据不包含阅读文章，因此不进入排版台账。

- `machine_audit` 只说明 JSON 是否具备正文和结构，不等于人工审核通过。
- `priority` 从 P0（最长、最拥挤）到 P3（已有空行），建议按此顺序复核。
- `recommended_action` 记录首选策略。多数课程已有可靠的 `blocks`，前端可直接按块显示段间距；NCE 和水木的混合内容仍需人工判断。
- `projected_blank_line_count` 与 `layout_outcome` 是前端排版后的预期结果；`implementation_status=applied_frontend` 表示无需污染课程原文即可生效。
- `review_status=resolved_frontend` 表示已逐文件检查并由统一排版策略解决；若人工抽检或内容校勘发现问题，可填写 `reviewer`、`reviewed_at` 和 `notes`，并改为 `passed`、`edited` 或 `needs_source_check`。

排版实现不会修改课程原文：1002 篇会利用原有块、章节或句行边界增加视觉空行；其余 52 篇本身是单个语义段落，由阅读区行宽、行高和内边距改善密度。这样既保留生成器的 `text/blocks` 一致性，也避免下一次生成课程数据时丢失人工插入的空行。

重新生成台账：

```powershell
npm run review:init:reading-layout
```

脚本会刷新机器指标，并按 `path` 保留已有的人工复核字段。不要为了视觉留白改动单词、标点、题号或中英对照关系；若确需修改 JSON，应同时核对其生成源，避免下次生成时被覆盖。
