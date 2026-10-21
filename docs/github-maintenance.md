# WordTap GitHub 设置交接清单

状态核对日期：2026-10-21。本文记录本仓库的介绍、反馈入口、依赖安全与 CI 状态；已验收基线为依赖修复提交 `663e9192`。下文固定链接对应该次已完成的验收，后续提交状态以 [Actions](https://github.com/hawkhai/wordtap.cn/actions) 为准。历史提交不改写，v2 不在修改范围。

## 仓库与 About

- GitHub 仓库：[hawkhai/wordtap.cn](https://github.com/hawkhai/wordtap.cn)。
- 已确认的可见性：公开；默认分支：`main`。
- Website：`https://wordtap.cn/`。
- About 已在线保存并核对，内容如下：

```text
WordTap｜英语点读为学习而生。点词查义、音标与发音、句子听读、词汇积累和文章跟打。无需注册，学习记录保存在浏览器。Open-source English learning with dictionary lookup, pronunciation and typing practice.
```

修改 README 不会自动同步 GitHub About、Topics 或 Social preview。项目介绍、源码与反馈链接均使用本仓库地址，不设置仓库对照或分流入口。

## Topics

最近已保存的标签如下；本轮不调整标签：

```text
english-learning, language-learning, learn-english, english, english-reading, dictionary, vocabulary, phonetics, pronunciation, text-to-speech, typing-practice, new-concept-english, ecdict, vue3, typescript
```

GitHub 的显示顺序可能按字母排序，以标签集合为准。Topics 不改变仓库可见性，也不保证搜索排名或 Star 增长。

## 分享封面

仓库素材：[GitHub 封面 JPG](../public/media/english-learning/wordtap-github-cover.jpg)及[HTML 源稿](../public/media/english-learning/cover-source.html)。封面保留“英语点读为学习而生”和“点词查义 · 听读发音 · 文章跟打”，不附加版本徽标。

分享封面已上传并核对。当前 [线上封面](https://repository-images.githubusercontent.com/1354473342/2ed759df-35d3-4c01-b9ce-d529d2a51536)与仓库 JPG 一致，1280 × 640、124,174 字节。

维护封面时保持源稿中的相对图片、字体和图标路径；以 1280 × 640 视口等待资源加载完成后导出 JPG，控制在 1 MB 以下。

## 反馈模板

- 提供“问题反馈”“功能建议”“课程勘误”和空白 Issue，所有反馈均在[本仓库](https://github.com/hawkhai/wordtap.cn/issues/new/choose)接收。
- 问题反馈收集运行环境、复现步骤、预期和实际行为；页面地址或提交哈希、日志或截图按需填写。
- 功能建议收集学习场景、当前不足与期望能力，替代方案选填。
- 课程勘误收集课程位置、最短原文、建议或疑问与依据；未确认的内容允许标为待核实。
- 联系入口提供官网与本仓库的学习教程；不依赖 Labels 或 Assignees。
- PR 模板要求改动目的、验证方式、界面截图和内容来源；避免公开凭据、学习备份或漏洞利用细节。

README、反馈模板与介绍清理已随提交 `4e079bf0` push 到默认分支，后续依赖修复提交 `663e9192` 也已 push。本次只读核对了线上选择器：三类表单、Blank issue、在线学习与教程入口均已显示；安全反馈入口指向仓库安全策略。未创建真实 Issue 或 PR，PR 模板自动填入留待下次真实 PR 验收。

## 依赖安全、CI 与已验收提交

- [依赖修复提交 `663e9192`](https://github.com/hawkhai/wordtap.cn/commit/663e9192cce1a7825dc8d7c2724e38e049a48a32)已 push 到 `main`，其 [Verify 运行](https://github.com/hawkhai/wordtap.cn/actions/runs/39593944966)为 **Success**，任务名为 `verify`。
- 原有 2 项 npm 依赖告警已修复。本次复核完整 `npm audit` 和 `npm audit --omit=dev` 均为 **0 项告警**。后续公告可能变化，复核方法及锁定版本见[开发指南](development.md#依赖安全状态)。
- [工作流](../.github/workflows/verify.yml)使用 `ubuntu-latest`、Node.js 20.19.0，执行 `npm ci`、完整 `npm run verify` 和生成文件差异检查。完整构建、85 项回归、发布数据、静态页面、仓库与响应式检查均已通过。
- `npm ci` 会输出审计摘要，目前没有独立的 `npm audit` 阻断步骤。

本次只读复核了 About、Topics、Website、反馈选择器及上述 CI 结果，没有更改 GitHub 在线设置。源码 push 与 CI 成功不代表站点已部署；未进行部署、Release 或实际听音验收。Gateway 独立交付，验证范围见[开发指南](development.md)。

## 维护待办

- [x] 依赖安全修复已 push，审计为 0 项告警，对应 `verify` 运行成功。
- [ ] 核对 Private vulnerability reporting 开关及私密报告入口；本次仅确认选择器可进入安全策略，未复核该开关或代为变更。
- [ ] 按需整理 Wiki／Projects；上次记录为两项开启、Discussions 关闭，本次未复核这些开关。
- [ ] 核对 `main` 的分支保护与 Rulesets，按实际协作需要禁止强推与删除，并选择已运行成功的 `verify` 检查。本次未复核当前规则，也未修改设置。
- [ ] 检查 Dependabot alerts、安全更新、Secret scanning 与 Push protection 的可用性和开启状态；本轮未完整核查。
- [ ] 单人维护按实际协作需要决定 PR、审批及规则例外，不添加无法满足的检查要求。
- [ ] 按实际维护需要处理主页置顶和空入口；不因宣传而开启空讨论区。
- [ ] 选择经过验证的提交安排 Release，说明环境、已知限制、学习备份范围及第三方内容许可；Gateway 独立交付，不附未经验证的安装包。
- [ ] 单独验收静态站点部署，不能根据源码已 push 推断网站已更新。

## 已完成的验收与范围

- 三类 Issue Forms 的 YAML、字段 ID、必填项与联系入口检查通过；没有版本分流下拉框。
- 依赖修复后的完整 `npm run verify` 本地与远程均通过；干净副本 `npm run verify:browser` 通过，包含学习备份迁移、查词、跟打、词汇与考试、深层链接、实际端口 HMR 和 Service Worker 在线／离线缓存。
- 生产页面在 1440、390、360px 下检查通过，查词、音标、跟打纠错与完成、刷新续练和 schemaVersion 4 完整备份导入导出正常，无页面横向溢出或脚本错误。朗读入口已检查，未人工听音；不包含 Gateway 安装器构建。
- 项目链接均指向本仓库，当前维护内容中不保留其他仓库的版本称呼或地址；课程原文、学习数据和许可证未修改。
- README、反馈模板、介绍清理与依赖修复均已进入远程默认分支；About、Topics 与 Website 本次只读复核一致。站点部署状态单独验收。
- 本次仅更新开发指南与本清单，文档链接、锚点、锁定版本和差异检查通过；两份文档在 1440、390、360px 下共 6 项本地渲染检查通过。未重复完整应用构建，文档提交对应 CI 以 Actions 的后续运行结果为准。

参考：[Issue Forms 配置](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)、[Topics](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)、[分享封面](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)。
