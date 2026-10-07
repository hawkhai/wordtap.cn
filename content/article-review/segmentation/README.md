# JSON 句段审核台账

本轮仅依据现有 lesson JSON 的全文、上下文和中英对应关系，覆盖七套课程的 1,054 篇文章。不读取 PDF、图片、原教材或外部资料，不改前端，不开展字词校勘。

`ledger.tsv` 是本轮逐篇进度，`summary.json` 汇总当前状态和剩余路径；[progress.md](progress.md) 列出已保存批次的结果及待确认问题。旧文章台账中的通过状态不代表本轮句段审核通过。`candidate_count` 是机器提示数量，可能包含词表、表格、双语或诗行等正常结构，不能据此自动修复或通过。

## 判定及证据

- 按自然段和双语对应单元恢复句段。英文续行补必要词间空格，中文续行直接接回；保留多句段落、题号、选项、词表及对话轮次。
- 非空白字符及其顺序必须不变。英中半句交替、错列表格等需要重排字符的问题保持原状，记录待确认。
- `pending` 待审，`in_review` 审核中，`edited_pending_recheck` 修改待复核，`passed_unchanged` 无修改通过，`passed_edited` 已修改通过，`needs_confirmation` 待确认。只有实际全文通读并复核才能登记后三种状态。
- `decisions/<course>/<id>.json` 保存当前的明确决定、完整阅读范围、上下文判断、原块索引、修改前后文本和遗留问题。索引指向该决定审核前的 JSON；修订的 `baselineDisplay` 保存对应全文。
- `coverage`、`notes` 必须是非空字符串，`issues` 必须是说明字符串数组；不符合格式的决定在修改发布文件之前拒绝。字词错误、题目内容缺失但边界明确的情况记入 `notes`，不冒充句段问题。
- 现有 `revisions`、`history`、`events.jsonl` 追加保存每轮修订。`reviewMode=json-segmentation-v1` 标识 JSON 审核，来源证据仅为不可变的旧修订 JSON 快照。通用旧台账中的 `needs_source_check` 对应本轮的 `needs_confirmation`，不表示本轮需要读取原教材。
- JSON 哈希变化使本轮通过状态失效。重新初始化恢复待审，历史修订不删除。补充复核通过 `revisit: true` 显式登记，仍须准确的当前哈希和全文复核确认。

## 命令

```powershell
npm run review:init:segmentation
npm run review:scan:segmentation
python tools/review-segmentation.py read --path public/shuimu/lessons/intermediate/061.json
python tools/review-segmentation.py record --path public/shuimu/lessons/intermediate/061.json --decision <明确编写的决定.json>
npm run verify:segmentation
npm run verify:segmentation:complete
npm run test:segmentation
python tools/review-articles.py verify-published
python tools/cleanup-articles.py check
```

`scan` 只输出 `candidates.json`，不改变审核状态；`read` 输出全文。`record` 一次登记一篇，默认关闭空格候选；支持现有 `mergeBlocks`、`splitBlocks` 和仅改空白的 `blockEdits`，每处必须说明理由。新概念仅可改阅读字段空白，字幕文字、角色、索引和时间轴精确保留。大学英语依然要求既有签名链有效，不直接绕过签名发布。

跨页续句需要同时合并和重新分段时，`splitBlocks` 可指定 `index` 与可选的 `end`（含末块，省略则仅拆一个块），`before` 必须精确列出范围内每个原块，`blocks` 列出最终完整段落。范围仍不得重叠，非空白顺序、块语言及标题/列表锚点继续校验；重放必须与登记操作完全一致。

普通检查验证七套课程的准确篇数、当前 JSON 哈希、重复显示字段及修订证据，并从已审 JSON 的基线快照验证修订重放和重复执行。完整度检查遇到任意待审、审核中、待复核或待确认记录必须失败。发布快照及原文恢复检查仅使用已有 JSON 记录，恢复报告维持原样，通过连续的完整文件哈希和显示哈希修订链接受已登记的句段调整。不要在本轮执行会重新读取教材的完整来源验证或课程生成器。

顺序：先复核用户示例，再依次水木（音标、初级、中级、中高级）、研究生、新概念、人教、大学英语、四六级、考研。当前进度以汇总文件为准，工具完成不表示 1,054 篇已经通读。

2026-10-07 用户明确授权按课程并行审核。并行审阅者逐篇实际通读并复核，生成带 `parallelReview: true` 的精确修订决定；主执行者统一串行登记，防止台账、事件链和目录并发写入。该标记只允许跨课程顺序登记，不豁免全文确认、当前哈希、修订重放或内容保护检查。

历史修订现无损保存于 `../history.zip`；原 `history/<sha256>.json` 引用由工具直接从 ZIP 解析，原字节哈希继续验证。当前逐篇决定、台账和剩余问题不受存储清理影响。
