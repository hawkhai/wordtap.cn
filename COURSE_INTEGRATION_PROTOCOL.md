# WordTap 课程接入协议

> 协议版本：1.0\
> 适用项目：WordTap Web\
> 已接入实现：新概念英语（`nce`）、水木英语（`shuimu`）、研究生英语（`postgraduate`）

本文档定义一套课程从原始资料转换到 WordTap 首页、点读工具和公开课文页面的完整接入约定。以后新增课程时，应优先遵守本文档，而不是复制某一套旧课程后再临时修改。

本文分为两类约定：

- “新增课程基线”是以后接入新课程必须遵守的规范。
- “现有兼容格式”记录三套已接入课程的真实差异，不要求为了统一文档而立即迁移旧数据。

## 1. 接入完成的定义

一套课程只有同时满足以下条件，才算完成接入：

1. 原始资料可以通过脚本稳定、重复地转换为 UTF-8 JSON。
2. `public/<courseId>/manifest.json` 能列出所有分组和课文。
3. 每篇课文都有独立 JSON，且包含可直接送入 WordTap 的 `text`。
4. 桌面版和移动版首页都能看到课程入口和课程下拉菜单。
5. 用户可以搜索、选择课文，并将正文载入点读区域。
6. 公开目录页和课文页可以访问，并能回到 WordTap 学习该课文。
7. URL 深链可以直接打开指定课文。
8. 数据校验、类型检查和生产构建全部通过。
9. 课程被加入 sitemap，生产环境的静态路径能够正确访问。

仅生成 JSON、仅出现一个首页链接，或只能在本机手动加载，都不算完整接入。

## 2. 标识与命名

每套课程先确定以下标识：

| 名称 | 格式 | 示例 |
|---|---|---|
| `courseId` | 小写英文、数字、短横线；应长期稳定 | `postgraduate` |
| 中文名称 | 用户可见的简短名称 | `研究生英语` |
| 分组名称 | 根据课程语义选择 | 册、级别、卷 |
| 短码前缀 | 1–3 个小写字母；全站唯一且长期稳定 | `pg` |
| Vue 组件 | PascalCase + `Dropdown.vue` | `PostgraduateDropdown.vue` |
| 数据模块 | camelCase + `Lessons.ts` | `postgraduateLessons.ts` |

`courseId` 同时用于：

- `public/<courseId>/`
- 公开目录 `/<courseId>/`
- `data-course-dropdown="<courseId>"`
- manifest 和课文 JSON 中 ID 的前缀
- 生成、校验和公开页面脚本的文件名

不要使用中文目录、空格、反斜杠或依赖本机绝对路径。

## 3. 标准目录结构

```text
原始资料目录/
└─ ...

tools/
├─ course-page-shared.mjs           # 所有课程静态页的统一页面壳、宽度、样式和课程导航
├─ generate-<courseId>-data.py       # 原始资料 -> public JSON
├─ verify-<courseId>.mjs             # 数据完整性校验
└─ generate-<courseId>-pages.mjs     # dist 公开目录页、课文页、sitemap

public/
└─ <courseId>/
   ├─ manifest.json
   └─ lessons/
      └─ <groupId>/
         ├─ 001.json
         └─ 002.json

src/
├─ <CourseName>Dropdown.vue
└─ shared/
   └─ data/
      └─ <courseId>Lessons.ts
```

这是新增课程的推荐结构。新概念英语属于现有兼容实现，其数据生成器仍位于 `scripts/generate_nce_json.py`。

生成结果必须写入 `public`，不要让浏览器直接读取原始仓库、PDF、LaTeX、Word 或开发机目录。

## 4. 数据协议

### 4.1 编码和通用规则

所有 JSON 必须：

- 使用 UTF-8 编码。
- 使用正斜杠 `/`。
- 不包含 BOM、替换字符 `U+FFFD`、危险控制字符或私用区乱码。
- 不包含 `D:\...` 等本机绝对路径。
- 不包含未处理的 LaTeX、HTML 模板或 OCR 控制标记。
- 保证相同输入产生相同的 ID、路径和排序。

所有 `jsonPath` 都是相对于 Vite `public` 根目录的路径：

```json
"jsonPath": "postgraduate/lessons/volume1/04.json"
```

禁止以下形式：

```json
"jsonPath": "/postgraduate/lessons/volume1/04.json"
"jsonPath": "D:\\project\\public\\postgraduate\\lessons\\volume1\\04.json"
```

### 4.2 Manifest 必需语义

当前三套课程分别使用 `books`、`levels`、`volumes` 表达课程分组。旧实现可以保留这些字段；它们在业务语义上都是“分组列表”，但当前代码尚未提供统一的运行时适配器。

Manifest 顶层至少具备：

```ts
interface CourseManifest {
  schemaVersion: 1;
  generatedAt: string;        // ISO 8601；公开页面和 sitemap 使用
  generator: string;          // 生成脚本路径
  generatorVersion: string;
  totalLessons: number;
  // books / levels / volumes / groups 中恰好选择一个
}
```

每个分组至少具备：

```ts
interface CourseGroup {
  id: string;                 // 在课程内唯一
  title: string;
  subtitle?: string;
  lessonCount: number;
  lessons: CourseLessonSummary[];
}
```

每篇课文摘要至少具备：

```ts
interface CourseLessonSummary {
  id: string;                 // 在全课程内唯一且适合 URL
  unitNo: number;             // 可排序、可显示的课号
  title: string;
  jsonPath: string;
}
```

`unitNo` 是新增课程的标准序号字段。新概念英语是现有兼容格式，使用 `lessonNo` 表达相同语义。

可以增加课程特有字段，例如：

- 新概念英语：`bookNo`、`lessonRange`、`titleZh`、`question`、`audio`
- 水木英语：`videoCount`
- 研究生英语：`theme`、`paragraphCount`

以下约束必须成立：

```text
manifest.totalLessons
  == 所有分组 lessonCount 之和
  == 所有分组 lessons.length 之和
```

### 4.3 课文详情必需字段

每篇课文 JSON 至少具备：

```ts
interface CourseLessonDetail {
  schemaVersion: 1;
  id: string;
  unitNo: number;
  title: string;
  jsonPath: string;
  text: string;
}
```

`jsonPath` 是新增课程详情的标准字段。新概念英语现有详情不包含该字段，加载路径只保存在 manifest 摘要中。

`text` 是 WordTap 点读工具的最终输入，必须满足：

- 是非空纯文本，不是 HTML。
- 段落之间使用 `\n` 或 `\n\n`。
- 标题是否拼入 `text` 必须在同一课程内保持一致。
- 正文必须清理源文件命令、页眉页脚、无意义页码和 OCR 噪声。
- 中英双语资料应保留明确的段落顺序，不要把全部英文和全部中文分离成两个大块。

推荐额外提供结构化 `blocks`，用于公开课文页面和未来功能：

```ts
interface CourseBlock {
  type: "heading" | "subheading" | "paragraph" | "list";
  text: string;
  lang?: "en" | "zh";
}
```

当存在 `blocks` 时，除非课程有明确的特殊规则，应保持：

```ts
detail.text === detail.blocks.map((block) => block.text).join("\n")
```

音频、视频、题目、翻译、时间戳等都是可选扩展字段，不能代替 `text`。

### 4.4 示例 Manifest

新课程推荐直接使用通用的 `groups` 字段：

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-07-21T00:00:00.000Z",
  "generator": "tools/generate-example-data.py",
  "generatorVersion": "1.0.0",
  "totalLessons": 1,
  "groups": [
    {
      "id": "book1",
      "title": "第一册",
      "subtitle": "基础课程",
      "lessonCount": 1,
      "lessons": [
        {
          "id": "book1-001",
          "groupId": "book1",
          "unitNo": 1,
          "title": "Example Lesson",
          "jsonPath": "example/lessons/book1/001.json"
        }
      ]
    }
  ]
}
```

### 4.5 示例课文详情

```json
{
  "schemaVersion": 1,
  "id": "book1-001",
  "groupId": "book1",
  "unitNo": 1,
  "title": "Example Lesson",
  "jsonPath": "example/lessons/book1/001.json",
  "text": "Example Lesson\nThis is the English text.\n这是中文译文。",
  "blocks": [
    {
      "type": "heading",
      "lang": "en",
      "text": "Example Lesson"
    },
    {
      "type": "paragraph",
      "lang": "en",
      "text": "This is the English text."
    },
    {
      "type": "paragraph",
      "lang": "zh",
      "text": "这是中文译文。"
    }
  ]
}
```

## 5. 数据生成器

`tools/generate-<courseId>-data.py` 负责把原始资料转换为标准 JSON。

生成器必须：

1. 从仓库内的明确源目录读取资料。
2. 在脚本中集中定义课程分组、ID 和输出路径规则。
3. 清理格式命令、控制字符、页眉页脚和已确认的 OCR 错误。
4. 先生成课文详情，再根据详情生成 manifest 摘要。
5. 创建目录时允许重复运行。
6. 使用 UTF-8 写文件，JSON 应保留中文而不是强制转成 `\uXXXX`。
7. 输出生成课文数量。
8. 不静默吞掉缺失文件、重复 ID 或空正文。

推荐生成命令：

```powershell
python tools/generate-<courseId>-data.py
```

原始资料需要以 Git 子模块接入时，应同时记录：

- `.gitmodules` 中的来源。
- 生成器依赖的具体文件。
- 首次拉取和更新子模块的命令。
- 原始资料的许可证和可公开发布范围。

当前课程源子模块布局：

| 子模块 | 本地路径 | 用途 |
|---|---|---|
| `New-Concept-English` | `content/New-Concept-English` | 新概念英语音频/文本补充来源 |
| `NCE/NCE` | `content/NCE` | 新概念英语文本来源 |
| `NCE/NCE-Flow` | `content/NCE-Flow` | 新概念英语 LRC/音频生成来源 |
| `NCE/English-for-post-graduate` | `content/English-for-post-graduate` | 研究生英语 LaTeX 来源 |

## 6. 前端数据适配器

在 `src/shared/data/<courseId>Lessons.ts` 中定义类型和加载函数。组件不得自己拼接部署根路径。

最小实现：

```ts
import { appAssetUrl } from "../utils/assetUrls";

export async function loadExampleManifest(): Promise<ExampleManifest> {
  const response = await fetch(appAssetUrl("example/manifest.json"), {
    cache: "force-cache",
  });
  if (!response.ok) {
    throw new Error(`Unable to load example manifest: ${response.status}`);
  }
  return (await response.json()) as ExampleManifest;
}

export async function loadExampleLesson(path: string): Promise<ExampleLessonDetail> {
  const response = await fetch(appAssetUrl(path), { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Unable to load ${path}: ${response.status}`);
  }
  return (await response.json()) as ExampleLessonDetail;
}
```

要求：

- 所有资源 URL 必须通过 `appAssetUrl()` 解析。
- HTTP 非 2xx 必须抛错。
- TypeScript 类型应覆盖 manifest、分组、摘要、详情和扩展字段。
- 可以缓存 manifest Promise；失败后应允许重试。
- 不要在数据模块中操作 Vue 状态或页面 DOM。

所有 Dropdown 必须统一通过数据适配器加载 manifest 和详情，不得在组件内直接请求课程 JSON。

## 7. 课程下拉组件

新增 `src/<CourseName>Dropdown.vue`。可以参考现有三个组件的交互和 CSS，但课程数据处理应调用自己的数据适配器。

组件必须：

- 在挂载后加载 manifest。
- 支持切换分组。
- 支持按课号和标题搜索；存在中文标题、主题等字段时也应纳入搜索。
- 加载课文期间防止重复点击。
- manifest 和课文加载失败时显示用户可理解的提示。
- 选择成功后触发统一事件：

```ts
const emit = defineEmits<{
  select: [text: string, title: string];
}>();
```

- `text` 是送入点读器的完整文本。
- `title` 是保存到文章历史中的短标题。
- 选择后关闭下拉菜单。

根节点必须有唯一标记：

```vue
<div class="nce-dropdown" data-course-dropdown="example">
```

点击外部关闭时使用 `closest()` 判断，不要在可能被 Vue 提升的根 VNode 上放模板 `ref`：

```ts
function handleClickOutside(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element) ||
      !target.closest('[data-course-dropdown="example"]')) {
    close();
  }
}
```

新增课程默认复用以下现有样式类：

- `nce-dropdown`
- `study-button`
- `nce-panel`
- `nce-book-tabs`
- `nce-book-tab`
- `nce-search`
- `nce-list`
- `nce-item`

只有现有样式不能表达课程需求时，才新增课程专属 CSS。

## 8. 接入桌面版和移动版

以下两个入口必须同步修改：

- `src/desktop/components/DesktopShell.vue`
- `src/mobile/components/MobileShell.vue`

每个入口都要完成：

1. 导入新 Dropdown 组件。
2. 在课程工具栏中渲染组件。
3. 绑定统一的 `@select` 处理函数。
4. 在首页品牌区加入公开课程入口。
5. 在页脚加入课程入口。
6. 为公开目录计算正确的 section URL。

示例：

```vue
<ExampleDropdown @select="handleCourseSelect" />
```

当前共享选择处理函数虽然名为 `handleNceSelect`，实际已经被三套课程共用。后续重构时建议改名为 `handleCourseSelect`，但新增课程不应复制一份相同处理逻辑。

## 9. URL 深链协议

公开课文页必须提供“在 WordTap 中学习”链接：

```text
/?l=x:b1-001#study
```

短码协议统一为 `l=<prefix>:<compactLessonId>`：

- `prefix` 只负责标识课程，例如 `nce`、`sm`、`pg`。
- `compactLessonId` 由可辨识的分组标记、保留前导零的原课号和可选文章字母组成。
- 分组标记通过固定算法生成，不维护任意别名映射：与课程前缀相同的开头可省略，多词组取各词首字母，带数字的单词组保留首字母和数字，普通单词统一保留前三个字母。
- manifest 继续保存完整稳定 ID；短码解析后必须先还原完整 ID，再到 manifest 中验证课文存在。
- 浏览器与构建脚本共用 `src/shared/utils/lessonShortProtocol.js`；`lessonUrls.ts` 只提供 TypeScript 导出入口。
- 静态课文页统一使用 `tools/course-page-shared.mjs` 的 `lessonToolHref()`。
- 公开链接必须带 `#study`。

当前压缩示例：

| 完整课文 ID | 短码 |
|---|---|
| `nce1-001` | `nce:1-001` |
| `phonetics-001` | `sm:pho-001` |
| `volume1-01` | `pg:v1-01` |
| `reading-writing-translation-01a` | `pg:rwt-01a` |

短码必须是一一映射，不能依赖“碰巧先匹配到”的顺序：

- 协议模块加载时断言课程前缀全局唯一，并断言同一课程内由算法生成的分组标记唯一。
- 全站校验器遍历三套 manifest 的每一个完整课文 ID，断言短码可无损往返、课号及前导零完全保留、短码全局唯一。
- 新增课程、分组或课文必须先进入协议配置和 manifest，再通过 `npm run verify:short-links`；任何歧义、未知分组、错误位数或重复 ID 都必须使构建失败。

在 `src/shared/composables/useWordTap.ts` 中：

1. 读取统一的 `l` 参数并严格解析短码。
2. 根据前缀选择课程 manifest。
3. 将课程内短 ID 还原为稳定的完整 `lessonId`，并查找课文 JSON 路径。
4. 调用对应数据适配器加载课文。
5. 用 `hydrateSourceText()` 写入点读区，清理启动示例和当前历史选择状态。
6. 更新状态并调用 `splitWords({ recordTextHistory: false })`。

课程 manifest 必须使用 `cache: "no-cache"`，避免新增课文的短码被旧清单判定为不存在；课文详情 JSON 可以继续使用 `force-cache`。

系统只识别统一短码。禁止生成、解析或保留课程专属的 JSON 路径查询参数；旧链接无需兼容，无法识别时按普通首页请求处理。

如果新课程的公开目录是 `/<courseId>/`，还必须把 `courseId` 加入：

- `src/shared/utils/assetUrls.ts` 的 section 识别逻辑。
- `vite.config.ts` 的开发服务器 section 路由逻辑。
- 桌面版和移动版当前的 `appSectionUrl()` section 识别逻辑。

## 10. 公开目录、课文页和 SEO

`tools/generate-<courseId>-pages.mjs` 在 Vite 构建后读取 `dist/<courseId>/manifest.json` 和课文详情，生成：

```text
dist/<courseId>/index.html
dist/<courseId>/<lessonId>/index.html
```

三套课程必须复用 `tools/course-page-shared.mjs` 导出的：

- `pageShell()`：统一 960px 页面宽度、顶部栏、按钮、卡片、正文、翻页和移动端响应式样式。
- `escapeHtml()`：统一 HTML 转义。
- `xmlEscape()`：统一 sitemap XML 转义。

禁止在单个课程生成器里再次复制完整的 `<html>` 页面壳或内嵌一套课程专属基础 CSS。课程生成器只负责课程特有的正文结构，例如 NCE 问题、水木视频和研究生中英段落。

首页点读区和所有公开课文页必须遵守同一套阅读排版协议：

- `--wordtap-reading-font-family: "Itim", "Microsoft YaHei UI", "Segoe UI", Arial, sans-serif`
- `--wordtap-reading-font-size: 1.5rem`
- `--wordtap-reading-line-height: 2.4rem`

首页的权威值定义在 `src/style.css`，静态页面壳在 `tools/course-page-shared.mjs` 中使用同名变量。不得为单个课程、中文对照段落或移动端另设更小的正文基础字号；标题、注释和导航可以有独立层级。`tools/verify-short-links.mjs` 会同时检查全部生成页的短码和阅读排版变量是否与首页一致。

共享页面壳右上角固定显示：

1. 新概念英语
2. 水木英语
3. 研究生英语
4. 进入学习工具／在 WordTap 中学习

当前课程使用 `aria-current="page"` 和统一高亮样式。新增课程时，必须先把课程加入 `course-page-shared.mjs` 的课程注册列表，使所有现有目录页和课文页在下一次构建后自动获得新入口。

目录页至少包含：

- 课程中文名称和简介。
- 课文总数。
- 按分组排列的全部课文。
- 进入 WordTap 的入口。
- 由共享页面壳生成的完整课程导航。

课文页至少包含：

- 唯一的 `<title>` 和 meta description。
- canonical URL。
- 课程、分组、课号和标题。
- 可阅读的正文。
- 上一篇、下一篇、返回目录。
- “在 WordTap 中学习”的深链。
- `Article` 或适合课程内容的 JSON-LD。

所有动态文本写入 HTML 前必须通过共享的 `escapeHtml()` 转义。禁止直接把课文内容拼入 HTML。

页面生成器还必须：

- 将目录页和全部课文页加入 `dist/sitemap.xml`。
- 使用 `SITE_URL`，默认生产域名为 `https://wordtap.cn`。
- 保证完整 `postbuild` 链路重复执行时不会产生重复 sitemap 条目。

当前 sitemap 构建有明确顺序依赖：

1. Vite 因 `emptyOutDir: true` 先清空并重建 `dist`。
2. `generate-nce-pages.mjs` 新建 `dist/sitemap.xml`。
3. `generate-shuimu-pages.mjs` 向现有 sitemap 追加水木英语。
4. `generate-postgraduate-pages.mjs` 再追加研究生英语。

因此，后两个追加脚本不能在同一个 `dist` 上单独重复执行，否则会产生重复条目。新增课程页面脚本必须放在 NCE 脚本之后、`restore-dist-deletions.mjs` 之前，并由最后的全站协议校验器检查。若希望页面脚本可独立运行，应先实现按 URL 去重或集中式 sitemap 生成器。

把脚本加入 `package.json` 的 `postbuild`：

```json
"postbuild": "node tools/generate-nce-pages.mjs && ... && node tools/generate-example-pages.mjs && node tools/restore-dist-deletions.mjs && node tools/verify-short-links.mjs"
```

`restore-dist-deletions.mjs` 保持为最后一个会修改 `dist` 的脚本，全站协议校验器必须在其后运行。

## 11. 数据校验协议

新增课程必须有 `tools/verify-<courseId>.mjs`，并在 `package.json` 中注册：

```json
"verify:example": "node tools/verify-example.mjs"
```

校验至少覆盖：

- `schemaVersion` 是支持的版本。
- generator 版本符合预期。
- 分组 ID、课文 ID 全部唯一。
- `lessonCount`、数组长度和 `totalLessons` 一致。
- 每个 `jsonPath` 文件真实存在。
- 摘要和详情的 `id`、`unitNo`、`title` 一致。
- `text` 非空且达到合理的最低长度。
- `blocks` 存在时数量合理，且能按协议还原 `text`。
- 课程要求双语时，至少存在英文和中文内容。
- 不含绝对路径、残留源格式命令、控制字符和替换字符。
- 音视频 URL 使用允许的 HTTPS 域名和格式。
- 已人工审核的修正表或映射表没有漂移。

不要只校验 JSON 能否解析。格式正确但内容为空、数量错误或路径泄漏，同样必须失败。

新概念英语是现有兼容实现：生成脚本内部检查预期数量、重复课号、详情文件存在性和摘要完整性，目前没有独立的 `verify:nce` 命令。新增课程不得据此省略独立校验器。

## 12. 构建与验收

新增课程的标准验收顺序：

```powershell
# 1. 重新生成数据
python tools/generate-<courseId>-data.py

# 2. 校验课程数据
npm run verify:<courseId>

# 3. TypeScript/Vue 类型检查
npm run typecheck

# 4. 生产构建和公开页面生成
npm run build

# 5. 本地开发回归
npm run dev
```

浏览器至少验证以下场景：

1. `http://localhost:5173/` 没有 Vue、模块加载或 HMR 错误。
2. 桌面宽度下首页入口和 Dropdown 都出现。
3. 移动宽度下首页入口和 Dropdown 都出现。
4. 每个分组至少打开一篇课文。
5. 搜索标题和课号都能命中。
6. 选择课文后点读区显示正确标题和正文。
7. `/<courseId>/` 目录可以打开。
8. `/<courseId>/<lessonId>/` 课文页可以打开。
9. 课文页的学习按钮能通过查询参数回到 WordTap 并自动载入正文。
10. 控制台没有 error 或 warn。

生产发布后还要检查：

- `https://wordtap.cn/<courseId>/manifest.json`
- `https://wordtap.cn/<courseId>/`
- 至少一个公开课文 URL
- 首页课程入口
- `https://wordtap.cn/sitemap.xml`

## 13. Service Worker 与开发环境

课程 JSON 在生产环境被首次请求后，会被 Service Worker 按同源静态资源缓存。发布同路径的新课程 JSON 时必须升级 `public/sw.js` 中的 `CACHE_NAME`，例如：

```js
const CACHE_NAME = "wordtap-v4";
```

开发环境不得由 Service Worker 缓存 Vite 的 `@vite/client` 或源码模块。必须保留当前规则：

- `src/main.ts` 只在生产环境注册 Service Worker。
- 开发环境注销旧 Service Worker 并清理 `wordtap-*` 缓存。
- `public/sw.js` 对 `localhost` 和 `127.0.0.1` 不拦截请求。

否则可能出现“源码已经导出，浏览器仍提示缺少导出”、HMR WebSocket 失败或页面空白。

## 14. 当前三套课程的实现映射

| 课程 | `courseId` | 分组字段 | 短码前缀 | 数据生成器 | 校验器 | 页面生成器 |
|---|---|---|---|---|---|---|
| 新概念英语 | `nce` | `books` | `nce` | `scripts/generate_nce_json.py` | 生成器内置检查；无独立命令 | `tools/generate-nce-pages.mjs` |
| 水木英语 | `shuimu` | `levels` | `sm` | `tools/generate-shuimu-data.py` | `tools/verify-shuimu.mjs` | `tools/generate-shuimu-pages.mjs` |
| 研究生英语 | `postgraduate` | `volumes` | `pg` | `tools/generate-postgraduate-data.py` | `tools/verify-postgraduate.mjs` | `tools/generate-postgraduate-pages.mjs` |

对应前端：

| 课程 | 数据适配器 | Dropdown |
|---|---|---|
| 新概念英语 | `src/shared/data/nceLessons.ts` | `src/NceDropdown.vue` |
| 水木英语 | `src/shared/data/shuimuLessons.ts` | `src/ShuimuDropdown.vue` |
| 研究生英语 | `src/shared/data/postgraduateLessons.ts` | `src/PostgraduateDropdown.vue` |

三套课程的静态页面共同使用 `tools/course-page-shared.mjs`，因此页面宽度、顶部课程导航、基础配色、目录卡片、正文卡片、翻页按钮和移动端断点只有一个维护来源。

现有数据兼容差异：

| 课程 | 课号字段 | 详情含 `jsonPath` | 结构化正文 |
|---|---|---|---|
| 新概念英语 | `lessonNo` | 否 | `sentences`，另有 `bodyText`、`bodyTextZh` |
| 水木英语 | `unitNo` | 是 | `blocks`，可附 `videos` |
| 研究生英语 | `unitNo` | 是 | 带 `lang` 的 `blocks` |

当前已知兼容债务：

- `appSectionUrl()` 在共享工具、桌面 Shell 和移动 Shell 中存在重复实现。
- 三套 Dropdown 共用的选择处理函数仍名为 `handleNceSelect`。
- 新概念英语没有独立的 `verify:nce` 命令。
- sitemap 依赖固定的生成脚本顺序，追加脚本不能独立重复运行。

这些差异是对当前代码的如实记录，不是新增课程可以继续复制的推荐模式。

## 15. 新课程接入检查清单

复制下面的清单到任务或 PR 描述：

```text
[ ] 已确定稳定的 courseId、中文名、分组方式和全站唯一短码前缀
[ ] 已确认原始资料许可证及公开发布范围
[ ] 已实现可重复运行的数据生成脚本
[ ] 已生成 public/<courseId>/manifest.json
[ ] 已生成全部 public/<courseId>/lessons/**/*.json
[ ] manifest 数量、ID、路径和详情一致
[ ] 详情包含可直接点读的纯文本 text
[ ] 已实现 src/shared/data/<courseId>Lessons.ts
[ ] 已实现 <CourseName>Dropdown.vue
[ ] 已接入 src/desktop/components/DesktopShell.vue
[ ] 已接入 src/mobile/components/MobileShell.vue
[ ] 首页品牌区和页脚均有课程入口
[ ] assetUrls.ts 和 vite.config.ts 已识别新 section
[ ] useWordTap.ts 已实现严格校验的 URL 深链
[ ] 已实现公开目录页、课文页和 sitemap 生成
[ ] 已把课程加入 tools/course-page-shared.mjs 的课程注册列表
[ ] 目录页和课文页均复用共享 pageShell，未复制基础 CSS
[ ] package.json 已加入 verify 和 postbuild
[ ] 已实现并通过课程数据校验
[ ] npm run typecheck 通过
[ ] npm run build 通过
[ ] 桌面、移动、搜索、选课和深链已完成浏览器验收
[ ] Service Worker 缓存版本已按需升级
[ ] 生产发布后的首页、JSON、目录、课文和 sitemap 已验证
```

## 16. 后续演进建议

当课程继续增加时，优先进行以下重构，避免每新增一套课程就修改多个入口：

1. 建立统一 `CourseManifest` 的 `groups` 格式和运行时适配器，并为旧课程保留转换层。
2. 抽取通用 `CourseDropdown.vue`，通过配置提供名称、搜索字段和标题格式。
3. 建立课程注册表，例如 `src/shared/data/courseRegistry.ts`，集中维护：
   - `courseId`
   - 中文名称
   - manifest 加载器
   - lesson 加载器
   - 深链参数和路径白名单
   - 首页及页脚排序
4. 在现有统一页面壳基础上，继续抽取通用内容渲染和 sitemap 生成器，让课程只提供文案与 block 渲染策略。
5. 建立一个总校验命令，自动发现并运行全部 `verify-*.mjs`。

在完成这些重构前，本文档第 1 至第 15 节是新增课程必须遵守的接入基线。

## 英语词汇接入补充

`english-vocabulary` 遵循课程 manifest/groups/lessons 协议，使用 `ev` 三位编号短码。23 套词库的完整词头检索索引独立存放于 `indexes/<groupId>.json`，按所选词库加载；manifest 不内嵌词头索引或词条详情。单元详情保留原始结构化 `entries`、阅读 `text`、练习 `typingText` 和源文件/行号。跟打提取失败必须提示重试，不能退回含音标和词性的阅读全文。公共页面和学习链接全部由同一份数据生成。
