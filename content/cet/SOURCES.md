# 英语四六级资料来源与补充指南

## 当前归档

本次下载的有效文件保存在：

- `raw/wehuster/`：34 个 PDF，约 17.8 MiB。
- `raw/zhengzhou-business-college/`：5 个 PDF，约 3.1 MiB。
- `source-files.json`：逐文件大小与 SHA-256 清单。
- `source-audit.json`：生成器对完整 CET 来源目录的文本层审计结果。

完整资料目录约 2.59 GiB，没有在仓库内重复复制；本次网络下载的补充文件已全部落在 `content/cet/raw`。

## 来源

### WeHUSTER

- 四级目录：https://www.wehuster.com/cet4
- 六级目录：https://www.wehuster.com/cet6
- 文件地址规律：`https://www.wehuster.com/static/{cet4|cet6}/{cet4|cet6}_YYYY_MM_N.pdf`
- 本次覆盖：2020 年 9 月、2022 年 9 月、2023 年 3 月，以及 2024/2025 年 6 月和 12 月。

四个规律地址在本次下载时不可用：

- `cet4_2022_09_2.pdf`
- `cet4_2023_03_2.pdf`
- `cet6_2022_09_2.pdf`
- `cet6_2023_03_2.pdf`

对应月份在原资料中仍有合卷或其他可用版本。下载脚本会记录失败，不会把 HTML 错误页当成 PDF。

### 郑州工商学院信息工程学院

- 来源页：https://xxgcxy.ztbu.edu.cn/2024_11/05_17/content-58245.html
- 已保留 2024 年 6 月四级第 1、3 套和六级第 1–3 套，共 5 个有效 PDF。
- 四级第 2 套附件下载得到的是 3805 字节 HTML 页面，未收入归档；该套使用 WeHUSTER 的有效 PDF。

### 新疆商贸经济学校英语文化部

- 来源页：https://www.xjsmc.edu.cn/yywhb/info/1081/1510.htm
- 页面列出了 2023 年 6/12 月与 2024 年 6 月资料，但附件下载需要验证码。
- 未绕过验证码，也未保存验证码 HTML；相关年份改用公开直链来源补充。

## 后续补充

1. 运行 `npm run fetch:cet-supplement`，重新校验并下载已登记的 WeHUSTER 文件。
2. 新 PDF 放入 `content/cet/raw/<来源名>/`，文件名优先采用 `cet4_YYYY_MM_N.pdf` 或 `cet6_YYYY_MM_N.pdf`。
3. 运行 `npm run inventory:course-sources` 更新 SHA-256 清单。
4. 若只验证新资料，可运行 `npm run generate:cet -- --source content/cet/raw`；发布完整课程时，应把原有完整目录和新资料合并到同一临时来源目录后再生成，避免覆盖成仅含补充年份的清单。
5. 运行 `npm run verify:cet` 和 `npm run build`。

稳定 ID 为 `cet4-YYYYMMNN` / `cet6-YYYYMMNN`，短码为 `cet:c4-YYYYMMNN` / `cet:c6-YYYYMMNN`。新增年份不会导致旧短码重排。
