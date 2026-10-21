# WordTap Web 迭代指引

本仓库为 WordTap 开源版。版本称呼统一使用“个人版”和“开源版”：个人版 GitHub 仓库为 `hawkhai/english_word_study_web`（本地目录名 `wordtap_web`），开源版 GitHub 仓库为 `hawkhai/wordtap.cn`。文档、代码注释和界面中的版本指代遵守此约定；教材原名、路径和技术标识保留原意。

前端功能迭代和界面修改先读取 `STYLE_GUIDE.md` 与 `CF_DESIGN_NOTES.md`，沿用 cf-design / Arco Design 的现有风格。

- 复用 `src/design.css` 的语义变量、阅读排版和交互状态；保留该文件在 `src/main.ts` 中最后加载的顺序。
- 保留桌面工作台、课程分组、移动端设置折叠及原有查词、朗读和数据保存流程。
- 技能可用时按 `STYLE_GUIDE.md` 的发现方式读取当前安装版 cf-design；不可用时使用仓库留档，不阻断普通 Web 开发。
- 不自动更换设计系统、技术栈或组件库；新增设计约定同步更新风格文档。
- 使用风格文档列出的定向检查，验证桌面和窄屏效果。


- 字体层级、控件尺寸与验收按 `UI_PRACTICE_STANDARD.md`；公共界面约定变化时同步更新。
- 开源版保留完整学习备份（包括文章与跟打进度）、官方下载修复、GitHub Issues 与源码入口；Gateway 独立交付。
