# WordTap GitHub 设置交接清单

状态核对日期：2026-10-21。本文记录已核实的 GitHub 设置、此前已 push 的内容及后续待办。版本称呼固定为“个人版”和“开源版”；本次仅更新本地交接文档与个人版封面资料，检查后分别本地提交，不 push，不操作 v2，也不更改在线设置。

## 仓库对应关系

| 版本 | GitHub 仓库 | 本地目录名 | 已确认的可见性与默认分支 |
| --- | --- | --- | --- |
| 个人版 | [hawkhai/english_word_study_web](https://github.com/hawkhai/english_word_study_web) | `wordtap_web` | 私有，`main`；已通过维护者登录态确认 |
| 开源版 | [hawkhai/wordtap.cn](https://github.com/hawkhai/wordtap.cn) | `wordtap.cn` | 公开，`main` |

个人版匿名访问返回 404 与其私有状态一致，现已确认远程地址有效，无须改名或调整可见性。公开体验与社区贡献入口均指向开源版；个人版链接需要相应仓库访问权限。

## 已保存的 About 与 Website

两版 About、Website 和 Topics 均已在线保存并核对。后续维护可复制下面的实际值；修改本地 README 不会同步这些 GitHub 设置。

开源版 Description：

```text
WordTap 开源版｜英语点读为学习而生。点词查义、音标与发音、句子听读、词汇积累和文章跟打。无需注册，学习记录保存在浏览器。English learning with tap-to-read, dictionary lookup, pronunciation and typing practice.
```

个人版 Description：

```text
WordTap 个人版｜英语点读为学习而生。点词查义、音标与发音、句子听读、词汇积累和文章跟打；包含内容维护工具与可选 Windows Gateway。公开体验与社区贡献：hawkhai/wordtap.cn。English learning app — personal edition.
```

两版 Website 均已保存为 `https://wordtap.cn/`。个人版将其作为公开体验入口，不表示该站部署了个人版全部维护工具或 Gateway。

## 已保存的 Topics

开源版共 15 个：

```text
english-learning, language-learning, learn-english, english, english-reading, dictionary, vocabulary, phonetics, pronunciation, text-to-speech, typing-practice, new-concept-english, ecdict, vue3, typescript
```

个人版共 18 个，在共同的学习与 Web 标签之外增加其实际使用的 Python、Rust 和 Windows 技术标签：

```text
english-learning, language-learning, learn-english, english, english-reading, dictionary, vocabulary, phonetics, pronunciation, text-to-speech, typing-practice, new-concept-english, ecdict, vue3, typescript, python, rust, windows
```

开源版原有 `reading` 已调整为 `english-reading`，移除重复的 `tts` 及较窄的 `cet4-words`、`cet6-words`。GitHub 的显示顺序可能按字母排序，以标签集合为准。Topics 不会改变仓库可见性，也不保证搜索排名或 Star 增长。

## 分享封面与上传状态

| 版本 | 当前状态 | 尺寸与大小 |
| --- | --- | --- |
| 开源版 | 已上传并刷新确认 Social preview，线上图片与仓库封面字节一致 | 1280 × 640，124,174 字节 |
| 个人版 | 带“个人版”标识的封面及 HTML 源稿已准备并纳入个人版本地仓库；尚未上传 | 1280 × 640，107,714 字节 |

- 开源版封面：[JPG](../public/media/english-learning/wordtap-github-cover.jpg)及[HTML 源稿](../public/media/english-learning/cover-source.html)。
- 个人版封面及源稿仅存放在个人版仓库的 `public/media/english-learning/wordtap-personal-github-cover.jpg` 与 `wordtap-personal-github-cover.html`；查看需要个人版访问权限，本次本地提交尚未 push。

开源版当前[线上分享封面](https://repository-images.githubusercontent.com/1354473342/2ed759df-35d3-4c01-b9ce-d529d2a51536)已生效。两版封面都沿用现有品牌样式与真实学习截图，保留“英语点读为学习而生”和“点词查义 · 听读发音 · 文章跟打”；个人版增加版本标识，并将网址标为“公开体验”。

个人版 Settings → General 当前没有 Social preview 上传入口。依据 [GitHub 分享封面说明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)，首次上传适用于公开仓库；私有仓库仅在此前已上传过图片时可继续上传，且图片只能由公开仓库对外分享。因此个人版封面当前保留为本地素材，不把它标记为已上传，也不为上传而更改可见性。

维护封面时，将对应 HTML 源稿与 JPG 放在同一素材目录，保持相对图片、字体和图标路径；以 1280 × 640 视口等待图片与字体加载完成后导出 JPG，控制在 1 MB 以下。无需修改页面功能或学习数据。

## 已 push 的内容与验收记录

此前经用户明确授权，学习定位、版本称呼、README、开发指南与反馈模板相关提交已 push。以下是本次文档更新前核实的远程默认分支记录，不包含这次尚未 push 的本地提交：

| 版本 | 远程分支 | 已 push 的提交 | 验证 |
| --- | --- | --- | --- |
| 个人版 | `main` | `3e43223fa2d5c04aedf290ee66372b4b084d2b30` | SSH 远程分支已核对；登录后 README 显示“个人版” |
| 开源版 | `main` | `c7e6c39c0b5bf96c5b2fdc96f57416fa4ef10919` | 远程分支已核对；README 与模板文件已上线；Verify 成功 |

- [x] 两版 README 已显示新的英语学习定位与准确的版本对应关系。
- [x] 两版三类 Issue Forms、选择器配置和 PR 模板文件已随此前提交进入默认分支。
- [x] 开源版 [Verify 工作流](https://github.com/hawkhai/wordtap.cn/actions/runs/39574519154)完成且结果为 success，对应上表开源版提交；检查任务为 `verify`。
- [x] 两版 About、Website、Topics 已保存；开源版分享封面已保存。
- [ ] 分别在 GitHub 的 Issues → New issue 核对三类表单、默认版本、空白 Issue、官网与教程链接；模板文件已上线不等于原生表单界面已验收，无需创建测试 Issue。
- [ ] 下次有真实 PR 时核对模板正文自动填入；本轮未为此创建测试 PR。
- [ ] 在 GitHub 原生页面补查 README 全部相对链接、图片与折叠动图；此前本地渲染检查与已显示的 README 标题不能代替所有线上链接验收。

个人版本地未发现 `.github/workflows/` 下的 CI 工作流，本轮没有新增 CI，也没有将开源版的 Verify 成功记录当作个人版远程 CI 结果。以上仓库状态不代表公开站部署或博客部署已验证。

## 仍待维护者决定或操作的事项

下面事项尚未完成或尚未核实，本次仅记录，不修改这些在线设置。

- [ ] 在维护者 GitHub 主页置顶开源版；个人主页的公开源码入口统一指向开源版。主页置顶当前状态尚未核实。
- [ ] 按实际维护需要整理 Wiki／Projects。开源版当前 Wiki、Projects 均开启，Discussions 关闭；个人版设置页显示 Wiki 不可用、Projects 开启、Discussions 关闭。无需为宣传额外开启空讨论区。
- [ ] 开源版开启 Private vulnerability reporting 并核对私密报告入口。2026-10-21 较早审查时未开启；此后未代为变更，本次未重新核验该项。
- [ ] 为 `main` 配置合适的分支保护或 Ruleset，禁止强推与删除；开源版可从成功工作流中选择实际的 `verify` 检查。2026-10-21 较早审查时开源版无分支保护且 Rulesets 为空，此后未代为变更，本次未重新核验该项。
- [ ] 个人版先决定并建立可用的 CI，再考虑必需状态检查，不添加永远无法满足的检查要求；单人维护不必强制第二人审批，例外与 PR 要求按实际协作方式决定。
- [ ] 检查两版 Dependabot alerts、安全更新、Secret scanning 与 Push protection 的可用性及开启状态；本轮没有完整核实，不将其记为全部关闭。
- [ ] 个人版如计划对外分发，先确认原创代码、维护资料与第三方内容的授权范围；保持现有许可边界，不直接套用开源版许可证。
- [ ] 为经过验证的开源版 Web 提交选择合适版本号与 Tag，安排首个正式 Release，记录功能、环境要求、已知限制和提交。个人版页面显示暂无 Release；开源版正式 Release 计划尚未执行。不要仅根据 `package.json` 占位版本号宣布稳定版本。
- [ ] Release 明确 Gateway 独立交付、两版备份差异及第三方内容许可；不附未经验证的安装包，也不将 Release 等同于部署。
- [ ] 这次交接文档与个人版封面检查后仅本地提交。需要发布这些新文件时另行授权 push；这不影响此前提交及 GitHub 设置已经上线的事实。

## 验证范围

此前纯文档与模板调整已通过：两仓库共 12 份文档、6 张 Issue Forms、2 份选择器配置检查；README、开发指南与当时交接清单在 1440、390、360px 下共 18 项本地页面检查，图片、折叠动图和导航可用。渲染使用 Marked 与本地 Markdown 样式，不等同于 GitHub 原生模板验收。

本次核对两版实际 Description、Website、Topics、已 push 提交及开源版远程 Verify 结果，检查更新文档的本地链接与格式、个人版封面尺寸、图片资源和可移植的相对路径，并运行开源版仓库检查。只改交接文档及个人版封面资料，不重复完整应用构建，不操作 v2。

本次检查通过：两份交接文档的本地链接、代码块及 Topics 数量一致性检查；1440、390、360px 下共 6 项文档渲染无页面横向溢出；个人版封面为 1280 × 640、107,714 字节，所有图片资源可加载，仓库内相对路径源稿能逐字节复现 JPG；开源版仓库检查与两版 `git diff --check` 通过。

参考：[Issue Forms 配置](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)、[表单字段规范](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-githubs-form-schema)、[Topics](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)、[分享封面](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)。
