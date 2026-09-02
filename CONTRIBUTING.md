# 参与贡献

感谢参与 WordTap。提交改动前，请先搜索现有 Issue，确认问题尚未被处理；较大的功能或数据变更建议先开 Issue 说明范围。

## 本地开发

Web 开发需要 Node.js 20.19 或更高版本：

```bash
npm ci
npm run dev
```

课程数据工具需要 Python 3.10 或更高版本：

```bash
python -m pip install -r requirements.txt
```

提交前运行完整检查：

```bash
npm run verify
```

完整检查包括类型检查、生产构建、生成页面验证、课程清单验证和开源仓库卫生检查。

## 提交约定

- 每个 Pull Request 聚焦一个问题，并说明行为变化及验证方式。
- 不要提交 `node_modules/`、`dist/`、安装包、原始教材、扫描件、OCR 中间文件、模型文件、密钥或本机路径。
- 修改课程数据时，同时更新相应来源清单、哈希或人工复核记录，并运行对应的生成与验证命令。
- 新增第三方代码、字体、音频、词典或课程内容时，必须记录来源和再分发依据；不确定时不要提交该材料。
- 保留 `LICENSE`、`NOTICE` 和 `THIRD_PARTY_NOTICES.md`。分发 fork 时还需遵守 README 中的派生项目署名要求。

贡献原创代码即表示你有权提交该内容，并同意其按仓库根目录的 Apache-2.0 许可证发布。第三方材料仍适用其各自的权利条件。
