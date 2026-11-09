# WordTap 搜索入口规则

生产站点由宝塔管理，站点根目录为 `/www/wwwroot/wordtap.cn`。2026-11-09 已将 HTTP 永久跳转和已发布课文的旧根路径跳转应用到现有 WordTap server 块，保留原有证书、PHP、缓存和错误页配置。

- `wordtap-server-snippet.conf`：当前混合监听 80/443 的站点使用此片段；不要替换整个 server 块。HTTP 保留路径和查询参数后 301 到 HTTPS；ACME 验证路径例外。
- `wordtap-lesson-redirects.conf`：构建自动生成，当前覆盖 1,054 篇课文。只重定向 manifest 中已发布且目标 HTML 存在的 ID；未知路径仍返回 404，词汇工作台不生成静态课文跳转。
- `wordtap-http.conf.example`：仅供 HTTP 与 TLS 分开监听时参考，不应在当前混合监听的配置上额外叠加同域 server。

课程增删后运行 `npm run build` 或 `npm run generate:search-redirects`，将生成的课文规则文件更新到 `/www/server/panel/vhost/rewrite/wordtap-lesson-redirects.conf`，通过面板保存站点配置检查语法并应用。该文件属于 Nginx server 级规则，不要放入其他站点或全局 http 上下文。

验收至少覆盖 HTTP 首页、带参数的 HTTP 旧课文地址、HTTPS 旧地址、正式目标、随机未知路径、ACME 路径、robots、sitemap 和三个验证文件。示例：`http://wordtap.cn/e1-2025?x=1` 应一次 301 到 `https://wordtap.cn/kaoyan-english/e1-2025/?x=1`，目标返回 200。

配置备份和本轮静态元信息回滚包保留在本机忽略目录 `tmp/search-console/2026-11-09/`。服务器更新包归档于 `/www/backup/wordtap-search-fix-20261109.zip`。
