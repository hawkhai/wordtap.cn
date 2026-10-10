# 当前发布信息

- `courses.json`：完整版发布基线版本、七套课程数量与发布文件 SHA-256。
- `vocabulary.json`：词汇上游固定提交与发布文件 SHA-256。
- `pending-source-checks.json`：120 篇待来源确认文章的身份与状态，不包含历史日志或正文副本。
- `vocabulary-issues.json`：16 处原样保留的词汇源数据问题。

七套课程共 1,054 份；英语词汇为 23 套、116,953 条、5,860 单元；人教版仍为 12/17 册。校验成功只表示发布结构与快照一致，不表示全部内容审核完成。

课程来源信息保留在发布 manifest 与详情的 source 字段中。ECDICT、研究生教材上游、词汇与字体许可证随公开资源保留，权利边界见 [第三方声明](../../THIRD_PARTY_NOTICES.md)。

词汇来源：KyleBing/english-vocabulary，固定提交 c4c6c80879ff17d7025c28fb853a4991c8e6be6a，BSD-3-Clause，许可位于 `public/english-vocabulary/LICENSE.txt`。

真题来源包括 WeHUSTER、郑州商学院、SWJTU Hub、懒笔记英语考试资料库；这些名称仅记录既有发布资料来源，不表示原始文件或下载／审核流程在本仓库可用。上游详细来源链接及逐篇源文件哈希保留在发布 JSON。

数据更新方法见 [课程接入协议](../../COURSE_INTEGRATION_PROTOCOL.md)。单个发布元数据文件不得超过 1 MiB，禁止引入台账、事件历史和大体积档案。
