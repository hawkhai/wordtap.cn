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

## 文章内空格审核（2026-10-01）

> 以下是远端 main 的历史空格审核流程及当时验收记录。2026-10-04 合并后，当前 1,054 篇正文以 `content/article-review` 的逐篇查源复核台账为准；旧空格台账和事件原样保留，不代表当前正文的待办状态。旧台账中的 460 篇 `needs_source_check` 是历史状态，当前查源台账已全部通过。
>
> 当前仍可使用 `read`、`inspect` 和只读 `scan` 查看建议；`apply`、`review`、`replay`、`recover` 在存在查源审核记录时拒绝写入，避免旧记录覆盖新校勘。后续修改使用 `tools/review-articles.py` 和对应课程生成器。`verify:spacing` 及构建前检查转接当前发布快照校验（覆盖率、显示哈希、修订证据、事件链），不要求构建机器拥有原始 PDF；`verify:spacing:complete` 额外要求全部通过。完整原始来源校验仍运行 `python tools/review-articles.py verify --require-complete`。下文旧重放和写入命令仅适用于没有查源审核记录的历史工作流。

`spacing-review-ledger.tsv` 与 `spacing-review-events.jsonl` 是独立的空格审核台账。上面的段落留白台账仅描述前端分段，不代表文章空格已经经过全文复核。

最终进度：**1,054 / 1,054 篇全部逐篇完整阅读，pending 为 0**。716 篇已修改，共插入 42,534 个普通半角空格（计入重复存储位置，不包含 manifest）；其余 338 篇没有重写。正文、分块、字幕、标题及目录摘要已经同步并通过一致性校验。

| 课程 | 总数 | 已修改 | 已全文阅读 |
| --- | ---: | ---: | ---: |
| 水木 | 192 | 192 | 192 |
| 研究生 | 40 | 23 | 40 |
| 四六级 | 97 | 97 | 97 |
| 考研 | 64 | 64 | 64 |
| 新概念 | 276 | 276 | 276 |
| 人教版 | 313 | 64 | 313 |
| 大学英语 | 72 | 0 | 72 |

最终审核状态：274 篇 `edited`、320 篇 `passed`、460 篇 `needs_source_check`。最后一种状态同样已全文阅读，但原有 OCR 损坏、缺文、双栏错序、异常断词等不能仅靠增加空格解决；7,184 条遗留定位（包含重复存储字段）均记录了具体 JSON 字段、UTF-16 位置、上下文及原因。排版复核完成不表示这些原始内容问题已修复。大学英语没有正文改动，72 篇既有签名审核记录全部保持有效。

### 规则及边界

- 中文与英文字母、阿拉伯数字之间补一个 U+0020；例如 `听Freya朗读` → `听 Freya 朗读`、`第1课` → `第 1 课`、`3M公司` → `3M 公司`。
- 明确的英文标点后接中文、词性标签和词表音标外侧补空格，如 `Thank you!谢谢`、`n.手提包`、`book[bʊk]书`。百分号与后续中文分隔，百分数本身保持完整。
- 不删除空格、不改换行、不重排段落，不改动任何非空白字符。只处理明确列出的展示字段；来源、文件路径、音频、视频、ID、时间轴和 JSON 结构保持原样。
- URL、邮箱、代码片段和 Windows 路径受保护；不机械拆分英文词、型号、缩写、音标内部或中文标点。英文标点疑点和 OCR 混入字形进入事件记录。四六级的中英字母边界保守保留为逐处复核项。
- 字典分片、下载元数据及 OCR 配置不属于文章。manifest 只同步被改文章的共享标题和字符数。保留三个既有摘要空格差异：`phonetics-002`、`phonetics-012`、`pepj9-011`；不删除已有空格来强行一致。
- NCE 的 `text` 原先已对部分 LRC 空格作规范化：验证忽略普通空格后内容与换行相同，同时严格验证 `bodyText/bodyTextZh` 与对应字幕；不把既有差异当作本轮改动。

### 台账与审计

`implementation_status` 表示规则是否应用；`review_status` 表示是否实际全文阅读，二者独立。`candidate_count` 是当前版本剩余可应用位置数，`inserted_spaces` 是有效变更累计插入数；最初扫描数保存在 `audit` 事件中。台账中的疑点计数也包含重复存储字段，疑点的 JSON Pointer、字符偏移（UTF-16）、上下文和原因在事件记录中。

审核状态为 `pending`、`edited`、`passed` 或 `needs_source_check`。只有实际读完全文、检查改动及所有疑点之后才能记录审核。机器扫描不会自动填写审核人，也不会自动通过审核。源文件哈希变化会使旧的全文复核失效。`needs_source_check` 表示已经读过，但原始内容仍有需要核对的问题，不等于内容正确。

事件日志追加保存 `audit`、`prepare`、`commit`、`review`，以及本轮收紧规则时的 `rollback` 历史。`prepare` 保存每个字段修改前后文本、插入位置、规则和文件哈希，`commit` 确认写入完成；撤回的事务不计入当前修改总数，也不参与重放。`review` 保存人工判断及明确排除的机器疑点。原有内容校勘记录不会被覆盖；大学英语签名正文如需修改，应先走其原有审核源和追加事件流程，工具会拒绝直接修改签名正文。

### 继续逐篇处理

```powershell
npm run review:scan:spacing
node tools/spacing-review.mjs read --file public/shuimu/lessons/beginner/011.json --offset 0 --length 12000
node tools/spacing-review.mjs inspect --file public/shuimu/lessons/beginner/011.json
npm run review:apply:spacing -- --file public/shuimu/lessons/beginner/011.json
```

`read` 输出总长度与本次范围，长文章须继续读取直到末尾；展示正文和不同的字幕内容，重复分块通过一致性验证。逐篇检查差异后，以当前哈希记录审核：

```powershell
node tools/spacing-review.mjs review --file public/shuimu/lessons/beginner/011.json --sha256 <当前文件SHA256> --reviewer Codex --status edited --note "全文阅读范围、具体修改判断与保留事项"
```

所有机器疑点均已逐条确认属于正常文本时，才加 `--resolve-findings`；有遗留事项用 `--status needs_source_check --issues <问题数组JSON文件>`，问题包含 `pointer`、`context` 和 `reason`；`context` 必须是当前展示字段中的精确片段，工具自动记录 UTF-16 `offset`，若显式提供位置则必须匹配。复查也验证最新疑点定位。

需要规则之外的插入时，`apply --file ... --decisions <JSON文件>` 接受 `{path, sha256, note, fields: [{pointer, offsets: [位置]}]}`。位置以修改前字符串的 UTF-16 偏移表示；工具仅允许插入普通空格，拒绝旧哈希、非展示字段及未同步 `text/blocks` 的修改。决策内容会保存在事务记录中。

课程顺序为水木、研究生、四六级、考研、新概念、人教版、大学英语。`apply --course <课程>` 仅执行规则处理，不代表该课程全文复核完成。不要并发运行修改、重放、恢复或扫描命令；事件日志与 manifest 是共享文件。

### 重放与验收

课程数据重新生成后运行：

```powershell
npm run review:replay:spacing
npm run review:scan:spacing
npm run verify:spacing
npm run test:spacing
```

重放先检查所有已记录字段，确认处于已知版本后才写入；原文发生其他变化时报告冲突，不套用旧修正。已应用内容再次重放不写文件。若文章和 manifest 写入途中中断，用 `node tools/spacing-review.mjs recover` 根据写前日志恢复，再验证。不要手工删改事件日志。

`npm run verify:spacing` 验证覆盖率、当前哈希、插入空格约束、正文/分块/字幕及目录摘要关系；它不宣称全文复核完成。全部文章阅读结束后使用 `npm run verify:spacing:complete` 检查是否仍有待审核项；本轮完整度检查已通过，1,054 篇均有匹配当前文件哈希的全文复核记录。即使完整度检查通过，也需另外查看 `needs_source_check` 的遗留问题。

构建前也运行普通的空格台账校验，防止课程重新生成后静默覆盖已应用的修正；待全文复核的状态不会阻止普通构建。

### 最终验证记录

- `npm run verify:spacing:complete`：1,054 篇覆盖完整、无重复、无待审核项；最新疑点定位、当前文件哈希、重复文本与 manifest 均一致。
- `npm run review:replay:spacing`：`changed: 0`，重复重放不写文件。
- `npm run test:spacing`：14 项通过，覆盖网址、邮箱、型号、音标、数字、重复执行、来源冲突、恢复、重放和审核证据失效。
- 水木、研究生、人教版、大学英语、四六级、考研英语现有校验全部通过；大学英语同时校验 728 页审核源及 72 篇已签名文章。
- `npm run typecheck`、`npm run verify:responsive`、`npm run build` 全部通过；生成并验证 1,054 个文章页面，扫描 12,277 份构建文本，验证 1,064 个静态页面共享风格。
- 逐字段对照 Git 基线：716 篇文章、5 份 manifest，共 721 份 JSON；仅展示文本增加空格及 314 个关联字符数字段变化，文章结构与其他元数据不变。包含 manifest 共增加 43,086 个空格。全部 11,198 份 public JSON 可解析。按 Git checkout filters 对照，721 份文件的原有换行风格均未改变；Git 对象的 LF 与 Windows 工作区 CRLF 差异不算内容改动。
- 浏览器最终抽查：1440×900 桌面和 390×844 窄屏，中英混排、数字标题、音标词表、长试卷无横向溢出；窄屏设置默认折叠。点击 `book` 返回离线释义并保存，文章进入历史记录并可恢复。全文朗读能进入声音生成状态并停止；没有把该结果表述为完整音频播放验证。

本地 5173 端口曾命中此前课程缓存，因此最终构建另在独立的 4174 端口复测，确认 `30 minutes` 等本轮修改已实际渲染。窄屏截图保存在本地忽略目录 `tmp/spacing-review/final-narrow-vocabulary.jpg`、`tmp/spacing-review/final-narrow-exam.jpg`。下载安装包缺失，构建按现有逻辑跳过安装包检查，未影响课程页面构建。

本次公开站同步不包含历史审核事件日志。当前发布内容的完整性由 `npm run verify:courses:published` 校验；原始事件链重放需另行提供审核资料。
