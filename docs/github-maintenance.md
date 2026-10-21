# WordTap GitHub 设置交接清单

状态核对日期：2026-10-21。本文记录本仓库的介绍、反馈入口、GitHub 设置、依赖安全与 CI 状态。依赖修复验收基线为 `663e9192`，最近已核对通过的提交为 `9aa8dd82`；下文固定链接对应已完成的运行，后续提交状态以 [Actions](https://github.com/hawkhai/wordtap.cn/actions) 为准。私密漏洞报告已按维护者授权开启，其它设置仅只读核查；本次仅同步文档，不操作在线设置。历史提交不改写，v2 不在修改范围。

## 仓库与 About

- GitHub 仓库：[hawkhai/wordtap.cn](https://github.com/hawkhai/wordtap.cn)。
- 已确认的可见性：公开；默认分支：`main`。
- Website：`https://wordtap.cn/`。
- About 已在线保存并核对，内容如下：

```text
WordTap｜英语点读为学习而生。点词查义、音标与发音、句子听读、词汇积累和文章跟打。无需注册，学习记录保存在浏览器。Open-source English learning with dictionary lookup, pronunciation and typing practice.
```

修改 README 不会自动同步 GitHub About、Topics 或 Social preview。项目介绍、源码与反馈链接均使用本仓库地址，不设置仓库对照或分流入口。页面、README、教程和分享文案中的 Star 支持入口统一指向 [hawkhai/wordtap.cn](https://github.com/hawkhai/wordtap.cn)。

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

私密漏洞报告开启后，已再次核对选择器中的“Report a security vulnerability”仍指向安全策略页；该链接去向与私密报告开关分别记录。私密报告功能已在 [Security 概览](https://github.com/hawkhai/wordtap.cn/security)确认显示 **Private vulnerability reporting · Enabled**，维护者可通过该页进入报告管理；未创建测试漏洞报告。

## 依赖安全、CI 与已验收提交

- [依赖修复提交 `663e9192`](https://github.com/hawkhai/wordtap.cn/commit/663e9192cce1a7825dc8d7c2724e38e049a48a32)已 push 到 `main`，其 [Verify 运行](https://github.com/hawkhai/wordtap.cn/actions/runs/39593944966)为 **Success**，任务名为 `verify`。
- 原有 2 项 npm 依赖告警已修复。依赖修复时复核完整 `npm audit` 和 `npm audit --omit=dev` 均为 **0 项告警**。后续公告可能变化，复核方法及锁定版本见[开发指南](development.md#依赖安全状态)。
- [工作流](../.github/workflows/verify.yml)使用 `ubuntu-latest`、Node.js 20.19.0，执行 `npm ci`、完整 `npm run verify` 和生成文件差异检查。完整构建、85 项回归、发布数据、静态页面、仓库与响应式检查均已通过。
- `npm ci` 会输出审计摘要，目前没有独立的 `npm audit` 阻断步骤。
- [介绍与分享素材清理提交 `3763f421`](https://github.com/hawkhai/wordtap.cn/commit/3763f4216cda0d2c60ee418deb292f57c1a8773c)已 push，其 [Verify 运行](https://github.com/hawkhai/wordtap.cn/actions/runs/39599149226)为 **Success**。后续文档提交不会自动成为已验收基线。
- [Star 支持入口提交 `9aa8dd82`](https://github.com/hawkhai/wordtap.cn/commit/9aa8dd82bdd45366e7ca2d53141ffdd958f6edc3)已 push，其 [Verify 运行](https://github.com/hawkhai/wordtap.cn/actions/runs/39621252481)为 **Success**；本次文档提交的 CI 结果仍单独确认。

依赖审计的 0 项告警是依赖修复时的验证结果，不表示 GitHub 已开启依赖监控；本轮只更新交接记录，没有重新执行依赖审计。Gateway 独立交付，验证范围见[开发指南](development.md)。

## GitHub 功能与保护设置

以下记录已核查的实际状态；其中私密漏洞报告已按授权开启，其它设置保持原状。“未开启”与“尚未核查”分别记录，不据此宣称仓库已完成全部安全配置。

| 设置项 | 当前实际状态 |
| --- | --- |
| Private vulnerability reporting | 2026-10-21 已开启；Security 概览显示 Enabled，设置页提供 Disable private vulnerability reporting 与配置入口 |
| Dependency graph | 未开启 |
| Dependabot alerts | 未开启 |
| Dependabot security updates／Grouped security updates | 均未开启 |
| Dependabot version updates | 设置页提供配置入口，尚未配置自动版本更新 |
| Secret Protection／Push protection | 均已开启，保留现状 |
| CodeQL analysis | 尚未配置，设置页显示 Set up |
| `main` 经典分支保护 | 未配置 |
| Rulesets | 列表为空，未创建规则集 |
| Issues／Pull requests | 均开启，允许所有用户创建 |
| Wiki／Projects／Discussions | Wiki 与 Projects 开启，Discussions 关闭；Wiki 仅协作者可编辑 |
| Release | 尚未发布正式 Release |

安全开关见 [Advanced Security](https://github.com/hawkhai/wordtap.cn/settings/security_analysis)；分支配置见 [Branches](https://github.com/hawkhai/wordtap.cn/settings/branches)与 [Rulesets](https://github.com/hawkhai/wordtap.cn/settings/rules)。此次已授权的设置操作仅开启私密漏洞报告；没有更改其它开关、创建规则、发布 Release 或变更仓库可见性。本次文档同步不再操作 GitHub 设置。

[Actions 设置](https://github.com/hawkhai/wordtap.cn/settings/actions)已核对：允许所有 Actions 与可复用工作流；未强制完整提交 SHA 固定。`GITHUB_TOKEN` 默认仅有仓库内容与包的读取权限，不允许 Actions 创建或批准 PR。外部首次贡献者的 fork PR 工作流需要维护者批准，日志及产物默认保留 90 天。

## 官网部署状态

2026-10-21，维护者已确认完成主站部署；本轮只读获取 `https://wordtap.cn/`，确认首页标题为“WordTap — 英语点读、查词听读与文章跟打”，页面包含“英语点读为学习而生”。不再将主站标为尚待部署。

此次记录不推断具体部署提交；尚未重新完成部署后的查词、朗读、跟打、备份与 Service Worker 缓存更新全流程验收，也未人工听音。本轮没有执行部署，源码 push、CI 与线上功能验收分别记录。

## 维护待办

- [x] 依赖安全修复已 push，审计为 0 项告警，对应 `verify` 运行成功。
- [x] 已核对安全功能、分支规则、Actions 权限与功能入口，实际状态见上表；核查不代表已启用待配置项。
- [x] Private vulnerability reporting 已开启；已核对设置页与 Security 概览的启用状态，未创建测试漏洞报告。
- [ ] 按维护安排开启依赖图、Dependabot 告警与安全更新；需要自动版本更新时另行配置，不将原有 0 告警当作持续监控。
- [ ] 为 `main` 评估禁止强推、禁止删除；采用 PR 流程后再选择已运行成功的 `verify` 必需检查。当前没有任何分支规则。
- [ ] 按实际维护计划整理 Wiki／Projects；保留已开启的 Secret Protection 与 Push protection。
- [ ] 单人维护按实际协作需要决定 PR、审批及规则例外，不添加无法满足的检查要求。
- [ ] 按实际维护需要处理主页置顶和空入口；不因宣传而开启空讨论区。
- [ ] 选择经过验证的提交安排 Release，说明环境、已知限制、学习备份范围及第三方内容许可；Gateway 独立交付，不附未经验证的安装包。
- [x] 维护者已确认主站部署，本轮首页标题与品牌标语复核一致。
- [ ] 完成部署后的功能、缓存更新与实际听音验收；不以首页文案检查替代全流程验证。

## 已完成的验收与范围

- 三类 Issue Forms 的 YAML、字段 ID、必填项与联系入口检查通过；没有版本分流下拉框。
- 依赖修复后的完整 `npm run verify` 本地与远程均通过；干净副本 `npm run verify:browser` 通过，包含学习备份迁移、查词、跟打、词汇与考试、深层链接、实际端口 HMR 和 Service Worker 在线／离线缓存。
- 此前本地生产构建预览在 1440、390、360px 下检查通过，查词、音标、跟打纠错与完成、刷新续练和 schemaVersion 4 完整备份导入导出正常，无页面横向溢出或脚本错误。该记录不等同于本次部署后的线上全流程验收；朗读入口已检查，未人工听音，不包含 Gateway 安装器构建。
- 项目链接均指向本仓库，当前维护内容中不保留其他仓库的版本称呼或地址；课程原文、学习数据和许可证未修改。
- README、反馈模板、介绍清理与依赖修复均已进入远程默认分支；About、Topics 与 Website 本次只读复核一致。站点部署状态单独验收。
- 本次仅更新本清单，将刚核查的设置与部署状态写入记录；文档链接、锚点、渲染和差异检查通过，未重复完整应用构建。文档提交对应 CI 以 Actions 的后续运行结果为准。

参考：[Issue Forms 配置](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)、[Topics](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)、[分享封面](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)。
