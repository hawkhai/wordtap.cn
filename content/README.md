# 课程原始资料归档

`content` 保存课程生成前的原始资料、来源说明和可复现清单；网站实际加载的数据位于 `public`。

## 本地原始文件

- `cet/raw/`：本次补充下载的 CET PDF，按来源分目录保存。
- `kaoyan-english/raw/`：考研英语一、英语二的原始 ZIP、解压 PDF/DOC 和替代合订 PDF。
- 两个 `raw/` 目录均被 `.gitignore` 忽略，避免数十 MB 二进制文件进入 Git；文件仍长期保留在本机仓库目录。
- `source-files.json` 记录每个原始文件的相对路径、字节数和 SHA-256，可检查文件是否缺失或被替换。

## 常用命令

```powershell
npm run fetch:cet-supplement
npm run fetch:kaoyan-english
npm run inventory:course-sources
npm run generate:cet -- --source content/cet/raw
npm run generate:kaoyan-english
npm run verify:cet
npm run verify:kaoyan-english
```

完整来源、年份范围、已知失败项和补充方法见：

- [英语四六级来源说明](cet/SOURCES.md)
- [考研英语来源说明](kaoyan-english/SOURCES.md)
