# 英语词汇接入验收

验收日期：2026-10-10。范围为根目录 WordTap，未修改 `v2/site`，未部署。

## 数据

- 固定上游提交 `c4c6c80879ff17d7025c28fb853a4991c8e6be6a`，23 套正序词库，116,953 条记录、5,860 单元，每单元最多 20 条。
- 原始文件 SHA-256、记录数、许可证与来源清单一致。逐文件重新生成比较通过，检查全部 5,884 个 JSON；词条、源行区间、索引和短码往返一致。
- 用户批准保留的 16 处源问题列于 `known-issues.json`，逐项校验字段与原值；新增异常仍中止生成。
- 6 项 Python 用例覆盖缺字段、多释义、多例句、重复词、连字符词、非法数据和精确例外；3 项 Node 用例覆盖全部单元、详情失败重试及刷新后的词库搜索索引恢复。

## 自动检查

以下全部通过：

```text
npm run verify:english-vocabulary
npm run test:english-vocabulary
node --test tools/article-typing.test.mjs tools/course-cache.test.mjs
npm run typecheck
npm run verify:responsive
npm run build
```

完整构建的 prebuild 包含 75 项既有及扩展测试；postbuild 生成 5,884 个词汇静态页面，检查 6,914 个课程单元页面的短链，并检查 10 个栏目共 6,948 个页面的共享样式。课程缓存测试覆盖索引离线读取与课程更新；跟打测试覆盖加载失败不回退、重试及草稿恢复。

完整构建使用 Node 和 Python 3.12；现有文章检查需要现代 Python。Windows 多 Python 环境须让 PATH 中的 `python` 与 `PYTHON` 环境变量指向同一解释器。安装包检查提示本机缺少 release installers，按既有脚本规则跳过；其余检查成功。

## 浏览器实测

在本地开发站点检查桌面 1440 × 1000、390 × 844 和 360 × 800；跨壳尺寸调整后刷新页面。

- 23 项词库选择器可用；按 `ruler`、`strawberry` 和单元编号搜索得到正确结果，空查询结果提示正常，Escape 返回菜单按钮。
- 刷新后恢复人教小学三年级词库，重新打开菜单仍可检索第 7 单元；末单元显示 16 词。
- 页面 `scrollWidth === clientWidth`，分别为 1425、375、345（浏览器滚动条占 15px）；360px 菜单选择器高 44px，移动设置保持折叠。
- 原始音标采用 Charis；音标段不生成点词按钮。点选 `ruler` 可查看已有词典释义，保存与累计点读计数更新。
- 单句朗读按钮进入“停止朗读本句”状态，浏览器无错误日志；此项确认播放流程和界面状态，未作音频听感验收。
- 第 1 单元跟打共 50 段，第一段为 `a 12-inch ruler`；完成一段后输入下一段草稿 `a sharp`，刷新重开后仍为 1/50 且草稿保留。第 7 单元为 38 段，均来自例句。
- 公开目录 → 分词库目录 → 第 7 单元 → WordTap 学习深链往返正常；静态单元在 360px 无横向溢出且音标字体正确。

本地截图：`tmp/vocabulary-verification/menu-desktop.png`、`tmp/vocabulary-verification/menu-360.png`。构建日志：`tmp/vocabulary-verification/build.log`（均为本地验收产物）。
