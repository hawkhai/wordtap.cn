# WordTap Web 迭代指引

前端功能迭代和界面修改先读取 `STYLE_GUIDE.md` 与 `CF_DESIGN_NOTES.md`，沿用 cf-design / Arco Design 的现有风格。

- 复用 `src/design.css` 的语义变量、阅读排版和交互状态；保留该文件在 `src/main.ts` 中最后加载的顺序。
- 保留桌面工作台、课程分组、移动端设置折叠及原有查词、朗读和数据保存流程。
- 技能可用时按 `STYLE_GUIDE.md` 的发现方式读取当前安装版 cf-design；不可用时使用仓库留档，不阻断普通 Web 开发。
- 不自动更换设计系统、技术栈或组件库；新增设计约定同步更新风格文档。
- 使用风格文档列出的定向检查，验证桌面和窄屏效果。

