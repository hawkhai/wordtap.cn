# 参与贡献

Web 开发只需要 Node.js 20.19+：

```bash
npm ci
npm run dev
```

贡献流程：修改功能或发布数据 → `npm run verify` → 提交。UI 修改先读 `STYLE_GUIDE.md`、`CF_DESIGN_NOTES.md` 和 `UI_PRACTICE_STANDARD.md`，同时检查桌面与窄屏；浏览器验收可独立运行 `npm run verify:browser`。

- 每个 Pull Request 聚焦一个问题，说明行为变化及验证方式。
- 发布数据变更遵循 [课程接入协议](COURSE_INTEGRATION_PROTOCOL.md)，核对来源、许可和已知问题后显式更新哈希，审查快照差异。
- 不提交安装器、模型、原始教材、OCR、审核台账、事件日志、历史档案、构建产物、密钥或本机路径。
- 保留 `LICENSE`、`NOTICE` 和 `THIRD_PARTY_NOTICES.md`；新增第三方内容记录来源和再分发依据。
- 完整版负责来源重建和历史审核，开源版不要求这些流程，也不能宣称发布校验等于内容审核。

贡献原创代码表示你有权提交并同意按 Apache-2.0 发布。第三方内容继续适用各自条件；派生项目署名遵循 README。安全漏洞按 [SECURITY.md](SECURITY.md) 报告。
