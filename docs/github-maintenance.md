# WordTap GitHub 设置交接清单

本轮仅准备本地文档与模板，不更改 GitHub 在线设置、不 push、不创建 Issue／PR／Release。下列事项需维护者在 GitHub 中完成。版本称呼固定为“个人版”和“开源版”。

## 仓库对应关系

| 版本 | GitHub 仓库 | 本地目录名 |
| --- | --- | --- |
| 个人版 | `hawkhai/english_word_study_web` | `wordtap_web` |
| 开源版 | [hawkhai/wordtap.cn](https://github.com/hawkhai/wordtap.cn) | `wordtap.cn` |

个人版地址来自当前 Git `origin`。2026-10-21 审查时匿名访问返回 404，尚不能确定是权限限制还是远程地址需要调整；请使用维护者账号确认，不据此更改可见性或重命名仓库。

## 可复制的 About 与 Website

开源版 Description：

```text
WordTap 开源版｜英语点读为学习而生。点词查义、音标与发音、句子听读、词汇积累和文章跟打。无需注册，学习记录保存在浏览器。English learning with tap-to-read, dictionary lookup, pronunciation and typing practice.
```

个人版 Description：

```text
WordTap 个人版｜英语点读为学习而生。包含英语学习 Web、内容维护工具与可选 Windows Gateway。公开体验与社区贡献入口：hawkhai/wordtap.cn。English learning app — personal edition.
```

两版 Website 均使用 `https://wordtap.cn/`。在各仓库首页 About 旁的编辑入口更新 Description、Website 和 Topics；这与修改本地 README 是不同操作。

## Topics

开源版建议使用下面 15 个与实际能力相符的标签；个人版如需配置 Topics，可使用同组标签。私有仓库的内容不会因此变为公开，Topic 名称本身可能公开，应避免内部信息。

```text
english-learning, language-learning, learn-english, english, english-reading, dictionary, vocabulary, phonetics, pronunciation, text-to-speech, typing-practice, new-concept-english, ecdict, vue3, typescript
```

已有标签保留上述共同项；把 `reading` 调整为 `english-reading`，移除重复的 `tts`，本轮不保留较窄的 `cet4-words`、`cet6-words`。无需凑满 20 个，不保证搜索排名或 Star 增长。

## 分享预览与主页入口

- [ ] Settings → General → Social preview：上传[现有 GitHub 封面](../public/media/english-learning/wordtap-github-cover.jpg)，1280 × 640、小于 1 MB。使用实心背景，上传后核对点读主体与标语。
- [ ] 在维护者个人 GitHub 主页置顶开源版，个人主页和博客的公开源码入口统一指向开源版。
- [ ] Wiki／Projects 仅在有持续维护内容时展示；现有文档集中于仓库，可按实际使用情况关闭空入口。
- [ ] Discussions 暂缓开启，先集中维护 Issues；不修改仓库名称或可见性。

## 安全与默认分支

- [ ] Settings 中开启开源版 Private vulnerability reporting，并到 Security → Advisories 核实私密报告入口。个人版按其实际可见性与可用设置处理，不承诺私有仓库一定支持同一功能。
- [ ] 为 `main` 配置有效的分支规则，禁止强推与删除，要求 CI 检查通过。开源版从最近成功的 Verify 工作流选择实际检查名称；个人版先确认存在可用 CI，不添加永远无法完成的必需检查。
- [ ] 单人维护不强制第二人审批；根据实际协作方式设置例外与 PR 要求。
- [ ] 检查 Dependabot alerts、可用的安全更新、Secret scanning 与 Push protection；按账号和仓库支持情况启用。此清单不表示这些功能当前全部关闭。
- [ ] 个人版如计划对外分发，先确认原创代码、维护资料和第三方内容的授权范围；本轮不把开源版许可证复制到个人版。

2026-10-21 审查时，开源版私密漏洞报告未开启，`main` 未启用分支保护且 Rulesets 为空；上线前重新核对当前状态。

## Push 后验收与首个 Release

- [ ] 用户自行检查并 push 本地提交；模板需要出现在默认分支才会生效。模板复制不会自动上传 About、Topics 或封面。
- [ ] 分别打开个人版、开源版的 Issues → New issue，确认三类表单、默认版本、空白 Issue、官网与教程链接；无需提交测试 Issue。
- [ ] 新建 PR 时确认模板正文自动填入；无需提交测试 PR。
- [ ] 确认两个 README 的相对链接、图片、折叠动图和运行命令在 GitHub 上显示正常，开源版 CI 通过。
- [ ] 为经过验证的 Web 提交选择合适版本号与 Tag，发布首个 Release，记录功能、环境要求、已知限制及对应提交。不要仅根据 `package.json` 的现有占位版本号宣布稳定版本。
- [ ] Release 明确 Gateway 独立交付、备份差异与第三方内容许可，不附未经验证的安装包，不代替实际部署。

## 本地检查与覆盖范围

本轮检查 Markdown 本地链接、锚点、图片与命令，解析三类 Issue Forms 和选择器配置，并渲染桌面及窄屏 README。GitHub 原生表单校验、真实权限、安全设置、远程 CI、Release 和公开站部署由上线后的人工验收确认。

2026-10-21 本地验收通过：两仓库共 12 份文档、6 张 Issue Forms、2 份选择器配置；README、开发指南和本清单在 1440、390、360px 下共 18 项页面检查通过，图片、折叠动图及文档导航可用。渲染使用 Marked 与本地 Markdown 样式，远程徽章使用布局占位，不等同于 GitHub 原生页面或远程 CI 验收。纯文档与模板改动未重复完整应用构建。

参考：[Issue Forms 配置](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)、[表单字段规范](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-githubs-form-schema)、[Topics](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)、[分享封面](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)。
