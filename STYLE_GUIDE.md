# WordTap Web 设计风格与技能留档

## 使用的技能与来源

- 流程技能：`easyclawdev-next`。本机入口为 `~/.agents/skills/easyclawdev-next/SKILL.md`，本项目按普通 Vue Web 源码维护，不套用 EasyClaw 应用清单或安装交付流程。
- 设计技能：当前安装版 EasyClaw 提供的 `cf-design`，默认采用 **Arco Design**。
- 本轮读取：`cf-design/SKILL.md`、`design-systems/arco-design/README.md`、`tokens/design-tokens.md`、`references/overview/theming.md`。
- 留档基线：2026-09-17，EasyClaw 1.3.105，CLI 0.0.68，同步来源：english_word_study_web 的设计提交 `b5861c8f`、静态主题 `cc6ffc4f` 与宽度修复 `24f64dc4`。

当前安装版采用 coding 资源布局：cf-design 相对资源根的位置为 `coding/shared/skills/cf-design/`。以后需要读取技能时，通过 easyclawdev-next 的安装上下文发现当前资源根；不要把本次安装版本的绝对路径当成永久路径，也不要复制整套发布资源到本仓库。技能升级后，保留本文与现有样式确定的产品风格，必要差异应明确说明。未安装技能时可直接依据本文及现有源码继续迭代。

## 风格基线

阅读优先、装饰克制、清晰层级、轻边框和轻阴影。品牌色集中用于主要操作、选中状态与链接。继续使用 Vue 原组件和 CSS，不因采用 Arco 规范而自动引入 React 或新的组件库。

| 用途 | 当前值 / 变量 |
| --- | --- |
| 主色 | `#165DFF` / `--wt-primary` |
| 主操作 hover | `#0E42D2` / `--wt-primary-hover` |
| 浅色选中背景 | `#E8F3FF` / `--wt-primary-soft` |
| 正文 / 辅助文字 | `#1D2129` / `--wt-text`；`#4E5969` / `--wt-secondary` |
| 边框 | `#E5E6EB` / `--wt-border` |
| 表面 / 页面背景 | `#FFFFFF` / `--wt-surface`；`#F7F8FA` / `--wt-background` |
| 间距 | 4px 倍数，常用 8 / 12 / 16 / 24 / 32 / 40 / 48px |
| 圆角 | 控件与普通容器 8px，工作台 12px；这是本项目对 Arco 小圆角的已采用调整 |
| 动效 | 颜色与背景过渡约 150ms，尊重 `prefers-reduced-motion` |

界面字体继续采用现有系统字体栈；英文阅读字体、字号与行高复用 `--wordtap-reading-*`。阅读行长上限 68ch，不重新添加横线背景或厚重阴影。标题、正文、辅助文字保持不同字号与字重。

## 实现入口与后续迭代

1. 改界面前读本文、`CF_DESIGN_NOTES.md` 和相关组件。`src/design.css` 是本轮主题样式入口，在 `src/main.ts` 中最后加载；优先复用已有 token 和类名，避免在组件内散落新的颜色与覆盖样式。
2. 保留桌面阅读工作台、课程分组与移动端默认折叠的“查词与朗读设置”。折叠仅改变展示，不改变选项默认值或设置绑定。断点沿用 `RESPONSIVE_GUIDE.md` 及项目的统一设备判断。
3. 新增控件覆盖实际需要的 hover、active、focus-visible、disabled、loading 状态；数据视图提供清晰的空状态与错误恢复。焦点必须可见，移动端主要触控目标至少 44px。
4. UI 迭代至少运行 `npm run typecheck`、`npm run verify:responsive`；涉及构建入口或交付产物时运行 `npm run build`。实际检查桌面与约 390px 窄屏，确认无横向溢出、菜单遮挡或阅读路径退化。
5. 新功能沿用现有查词、朗读与保存流程；视觉改动不擅自改变能力、认证、数据或 Gateway 行为。新增公共设计约定时同步更新本文。

本文记录设计决策与迭代约定，不是运行时依赖，也不声明所有旧页面均已完成 Arco 迁移。

## 静态网页生成路径

Vue 与生成的课程目录、课文、考试入口、安装指南共用 `src/design-tokens.css`。Vue 由 `src/design.css` 引入；生成器由 `tools/course-page-shared.mjs` 读取并内嵌，页面不依赖 Vue 样式包。静态布局和组件样式维护于共享生成器及考试、安装指南生成器。修改风格时同时核对两条路径；`npm run build` 会运行主题回归测试，并通过 `tools/verify-static-design.mjs` 检查全部生成页面。

页面外层宽度统一复用 `--wt-content-max-width: 88rem`；桌面左右各 24px，640px 以下左右各 16px。该上限同时应用于 Vue 工作台与全部静态生成页面；英文正文的 68ch 行长约束与外层页面宽度分别维护。
