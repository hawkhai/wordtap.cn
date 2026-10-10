# 英语词汇来源与维护

来源：[KyleBing/english-vocabulary](https://github.com/KyleBing/english-vocabulary)，固定提交 `c4c6c80879ff17d7025c28fb853a4991c8e6be6a`。
使用 `full_line_jsonl/sentence/正序` 全部 23 套词库，共 116,953 条源记录，按源文件顺序每 20 条分为一个学习单元，共 5,860 单元。正序是上游目录名称，合并后的文件不保证全局字母排序。重复词条不合并。

`raw/` 保存下载的原始 JSONL，按现有课程惯例被 Git 忽略，可由固定提交重新下载；`source-manifest.json` 记录精确 URL、字节数、SHA-256、行数与上游提交日期。`LICENSE` 原样保留上游 BSD-3-Clause 许可证，发布副本位于 `public/english-vocabulary/LICENSE.txt`。

## 生成和检查

```powershell
npm run fetch:english-vocabulary
npm run generate:english-vocabulary
npm run verify:english-vocabulary
npm run test:english-vocabulary
npm run build
```

下载只在显式执行 fetch 时联网；生成、验证和构建均使用本地文件。新机器先下载固定源文件再构建。词库稳定标识维护于 `tools/english_vocabulary.py` 的 `BOOKS`，与短码配置同步。更新上游版本须同时审查来源清单、词条顺序、已知问题及单元身份，不能只切换到 master；已有单元编号不得因新增词库而改变。

## 已知源问题

完整台账见 [known-issues.json](known-issues.json)：15 处替换字符或私用字符、1 处英文例句为空但译文存在。2026-10-10 用户确认保留上游原文并列入已知问题，全部 16 处按原字段原值保留，不补写、不替换、不删除词条。空英文例句不加入跟打，已有中文译文仍展示。

校验逐项输出已知问题；例外必须匹配固定提交、词库、行号、字段和值。任何新乱码、空词头、坏行、失效的例外或源哈希变化都中止生成/验证，不能自动扩大例外。

## 运行数据

`manifest.json` 只含词库和单元摘要；词头检索索引按词库加载；单元 JSON 包含原始结构化 `entries`、阅读 `text`、例句跟打 `typingText` 和源行区间。阅读文本以词头、英美音标、释义、短语、例句和译文排列；跟打只提取有英文字母的例句，无例句时使用词头。

公开目录为 `/english-vocabulary/`，分词库目录为 `/english-vocabulary/books/<groupId>/`，单元页为 `/english-vocabulary/<lessonId>/`。分享码采用 `ev:<词库标识去掉ev前缀>-<三位单元号>`，例如 `ev:junior-001`。
