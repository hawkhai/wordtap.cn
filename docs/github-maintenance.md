# WordTap GitHub 设置交接清单

状态核对日期：2026-10-21。本文只记录本仓库的介绍、反馈入口、CI 与维护待办。历史提交不改写；本轮本地文件调整尚未 push，v2 不在修改范围。

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

本轮移除版本分流字段并调整介绍；文件需要在后续授权 push 后进入默认分支，才能改变 GitHub 原生表单。届时重新打开选择器和三张表单核对，不创建测试 Issue。PR 自动填入在下次真实 PR 时验收。

## CI 与提交状态

远程 `main` 已包含 `d409959f383ee655a15c3dce5d985fef7bc0ffad`；对应 [Verify 工作流](https://github.com/hawkhai/wordtap.cn/actions/runs/39576548853)成功，任务名为 `verify`。本轮尚未 push 的反馈与介绍调整不包含在该次成功记录中。

CI 通过不代表公开站部署或实际听音已验收。环境要求、备份内容与安装包检查范围见[开发指南](development.md)。本轮不部署、不发布，也不修改分支规则或安全设置。

## 维护待办

- [ ] 如需私密漏洞报告，开启 Private vulnerability reporting 并核对入口。较早核查时未开启；本轮未代为变更。
- [ ] 按需整理 Wiki／Projects；最近核查时两项均开启，Discussions 关闭。
- [ ] 为 `main` 配置合适的保护规则，禁止强推与删除，并按实际工作流选择 `verify` 检查。较早核查时分支保护未开启、Rulesets 为空；本轮未代为变更。
- [ ] 检查 Dependabot alerts、安全更新、Secret scanning 与 Push protection 的可用性和开启状态；本轮未完整核查。
- [ ] 单人维护按实际协作需要决定 PR、审批及规则例外，不添加无法满足的检查要求。
- [ ] 按实际维护需要处理主页置顶和空入口；不因宣传而开启空讨论区。
- [ ] 选择经过验证的提交安排 Release，说明环境、已知限制、学习备份范围及第三方内容许可；Gateway 独立交付，不附未经验证的安装包。
- [ ] 本轮本地变更需另行授权提交或 push，线上 README、模板和静态站点仍以已发布内容为准。

## 本轮本地验证

- 三类 Issue Forms 的 YAML、字段 ID、必填项与联系入口检查通过；没有版本分流下拉框。
- README、学习教程和本清单在 1440、390、360px 下共 9 项本地渲染检查通过；工作台与课程目录同宽度下共 6 项生产预览检查通过，无页面横向溢出或脚本错误。
- 项目链接均指向本仓库，当前维护内容中不保留其他仓库的版本称呼或地址；课程原文、学习数据和许可证未修改。
- `npm run verify` 通过，包含完整构建、85 项回归、发布数据、静态页面、仓库与响应式检查；`git diff --check` 通过。
- GitHub About 已保存；本轮 README、反馈模板及页面文案尚未 push，原生表单与已部署站点仍使用此前发布的内容。

参考：[Issue Forms 配置](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)、[Topics](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)、[分享封面](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)。
