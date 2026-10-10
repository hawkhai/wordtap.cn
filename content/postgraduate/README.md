# 研究生英语补充内容入口

上游子模块 `NCE/English-for-post-graduate` 当前挂载在 `content/English-for-post-graduate`；其上册只包含第 4、5、7、8 单元。合法取得并校对缺失单元后，将每课保存为：

```text
content/postgraduate/volume1/01.json
content/postgraduate/volume1/02.json
content/postgraduate/volume1/03.json
content/postgraduate/volume1/06.json
content/postgraduate/volume1/09.json
content/postgraduate/volume1/10.json
```

文件格式：

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

要求：

- `title` 和 `theme` 必须与教材目录一致，生成器会严格校验。
- `blocks` 只接受非空的中英文段落，不接受占位符。
- `source.rightsBasis` 必填，用于记录内容取得和再分发依据。
- 不要把第三方文档搬运站下载的文件直接提交到仓库。

生成与校验：

```powershell
python tools/generate-postgraduate-data.py
npm run verify:postgraduate
npm run verify:postgraduate:complete
```

前一个校验检查现有数据结构和目录覆盖状态；最后一个命令只有在上下册共 20 课全部存在时才会通过。
