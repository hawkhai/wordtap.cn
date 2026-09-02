# 研究生英语数据说明

仓库中的可直接使用数据位于 `public/postgraduate/`，当前清单包含 40/40 篇：上、下册双语文章各 10 篇，以及《研究生英语读写译教程》课文 20 篇。完整性由 `npm run verify:postgraduate:complete` 校验。

## 来源边界

- 上、下册基础数据来自 [xiaoleeza/English-for-post-graduate](https://github.com/xiaoleeza/English-for-post-graduate)。重新生成时，将合法取得的上游工作副本放在 `content/English-for-post-graduate/`；该目录被根 `.gitignore` 忽略。
- 上册补充文件放在 `content/postgraduate/volume1/`。该目录也被忽略，避免未经确认的教材扫描或转录内容被直接提交。
- 《研究生英语读写译教程》的本地扫描、图片和 OCR 中间文件放在 `tools/graduate/`，不会进入 Git。
- 已生成课程仍受各自上游许可证和底层教材权利约束，详见根目录 `THIRD_PARTY_NOTICES.md`。

`public/postgraduate/` 已提交到仓库，因此正常安装、构建和验证不需要上述本地原始资料。只有重新生成课程数据时才需要准备它们。

## 上册补充格式

每课保存为 `content/postgraduate/volume1/NN.json`：

```json
{
  "schemaVersion": 1,
  "unitNo": 1,
  "title": "Traits of the Key Players",
  "theme": "Planning Your Future Career",
  "source": {
    "description": "用户提供的合法教材扫描件 OCR",
    "rightsBasis": "user-provided"
  },
  "blocks": [
    {
      "type": "paragraph",
      "lang": "en",
      "text": "English paragraph."
    },
    {
      "type": "paragraph",
      "lang": "zh",
      "text": "对应的中文段落。"
    }
  ]
}
```

`source.rightsBasis` 必填。不要提交来源不明的教材、扫描件或第三方文档站下载文件。

生成与校验：

```powershell
python tools/generate-postgraduate-data.py
npm run verify:postgraduate
npm run verify:postgraduate:complete
```

默认生成器还会读取 `tools/graduate/ocr/json/`。也可以直接运行脚本并通过 `--source`、`--supplements`、`--graduate-ocr` 和 `--output` 显式指定目录。
