# WordTap 公开站界面改进

本仓库同步 english_word_study_web 的 cf-design / Arco Design 风格。继续使用现有 Vue 组件和 CSS，无新增组件库依赖；后续迭代以 STYLE_GUIDE.md 为准。

- 主色 #165DFF，正文 #1D2129，辅助文字 #4E5969；阅读表面为白色，使用轻边框与轻阴影。
- 保留桌面工作台、课程分组与移动端默认折叠的查词和朗读设置，沿用原设置绑定。
- Vue 与静态生成页面共用 src/design-tokens.css；外层最大宽度 88rem，桌面左右各 24px，640px 以下各 16px。英文正文单独限制为 68ch。
- 保留公开站的 GitHub Issues 反馈、项目源码链接和独立 Gateway 交付边界。
- 控件以 8px、工作台以 12px 圆角为主；这是项目对 Arco 基础小圆角的调整。保留阅读字体、语义警告色和原功能流程。

改动入口：src/design.css、src/mobile/components/MobileShell.vue、tools/course-page-shared.mjs，以及考试和安装指南生成器。构建运行主题回归测试，并检查全部生成页面的主题和宽度。
