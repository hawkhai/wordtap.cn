# WordTap 项目介绍与分享文案

介绍 WordTap 时，先让读者看到一个具体场景：**把正在读的英文粘贴进来，在原句旁查词，再跟打同一段材料。** [五步图文教程](technical-english-reading.md) 可以直接用作第一次体验的入口。

## 一句话介绍

WordTap 是开源英语阅读与文章跟打工具：粘贴自己的英文，在原句旁查中文释义、听发音，再用同一段材料逐句练习输入；无需注册，学习记录保存在当前浏览器。

English: WordTap is an open-source English reading and typing practice tool for Chinese-speaking learners. Paste your own text, tap words for Chinese definitions and pronunciation, then practice typing the same passage. No account required; study records stay in your browser.

## 面向开发者的介绍

**建议标题：读 README 被生词打断？试试把原文查词和跟打放在一起的 WordTap**

读 README、API 说明或英文报错时，查完词还要回到原句找上下文。WordTap 把这些步骤放进一个浏览器工作区：粘贴英文正文，点词看中文释义、听发音，读懂后直接跟打同一段材料。跟打会指出具体字母错误，也能保存草稿和进度。

可以先用两句缓存说明试一次，也可以换成你今天正在读的文档。无需注册，基础阅读、ECDICT 查词和文章跟打无需安装额外服务。跟打比较英文字母，忽略大小写、空格和标点，适合英文句子练习。

在线试用：[wordtap.cn](https://wordtap.cn/) · 五步教程：[原文查词，再逐句跟打](https://github.com/hawkhai/wordtap.cn/blob/main/docs/technical-english-reading.md) · 源码：[hawkhai/wordtap.cn](https://github.com/hawkhai/wordtap.cn)

如果这种方式对你有用，欢迎给项目一个 Star，也欢迎反馈你在读哪类材料、哪一步最不顺手。

**配图：** 首选教程图 2（`cache` 原句查词）；若能放两张，再加图 3（`responsex` 字母纠错）。图片下使用教程已有图注，让读者知道需要观察哪里。

## 面向英语学习者的介绍

**建议标题：用自己选的英文练阅读和拼写：WordTap 开源工具**

如果你想精读课文、文章或邮件，可以试试 WordTap：把一小段英文粘贴进去，点击生词看中文释义、听发音，读懂后逐句跟打。练习材料由你选择，查词和输入都围绕同一段原文进行。

无需注册，可以从 2–5 句开始。查过的词、文章和跟打进度保存在当前浏览器；换设备前要导出备份，不会自动同步。

在线体验：[wordtap.cn](https://wordtap.cn/) · 第一次练习：[五步图文教程](https://github.com/hawkhai/wordtap.cn/blob/main/docs/technical-english-reading.md) · 开源项目：[GitHub](https://github.com/hawkhai/wordtap.cn)

**配图：** 使用教程图 1（放入自己的材料）和图 2（原句旁查词）；更完整的操作留给教程，不必在短介绍里放满五张图。

## 短介绍

读英文时，能不能查完词就接着读，再用原文练一遍？WordTap 把点词查中文释义、听发音和逐句跟打放在一起。粘贴自己的材料即可开始，无需注册，学习记录本地保存。试用：[wordtap.cn](https://wordtap.cn/)；源码：[GitHub](https://github.com/hawkhai/wordtap.cn)。

## 推荐的发布顺序

1. 先重拍图 2 与图 3，检查图片缩到正文宽度后仍能看清词义与错误提示。再补齐另外三张；参考 [截图拍摄清单](../public/media/technical-english/README.md)。
2. 同时替换仓库和博客的同名图片，更新拍摄来源。GIF 需要单独更新；未更新时可以先移除动图入口。
3. 发布 README、教程和博客后，逐个确认试用、源码与图片链接；用手机再读一遍博客。先发布一篇完整博客，再针对你已参与的技术或学习社区选择一版短介绍。
4. 发布后记录读者提出的实际问题。下一篇内容可以回答“拿什么材料练”“如何恢复进度”或一个真实的浏览器兼容问题，让每次分享提供新信息。

不要只记录 Star 数。也记录哪些介绍带来了访问、读者是否顺利完成第一次练习、哪些步骤被反复询问。来源数据只使用已经可用的统计或自愿反馈；这份文案不要求增加用户追踪。

## GitHub 入口检查

仓库已有在线体验地址、双语 About、英语学习／词典／跟打等 Topics，以及网站与练习完成区的 GitHub 入口。下一步优先改进截图和首次体验，保持项目介绍、教程与站点摘要一致。

GitHub 的 [README 文档](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes) 强调说明项目用途、价值和使用方式；[Topics 文档](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics) 说明相关主题能帮助读者发现项目。这些入口值得维护，但不能据此保证 Star 增长。

如需设置仓库 Social preview，可在新截图确认后制作一张突出项目名称、原句查词和跟打反馈的预览图。GitHub 推荐 1280 × 640；具体设置见 [官方说明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)。仓库 Social preview、网站 Open Graph 图片和文章正文截图是三个独立入口，更新其中一处不会自动更新另外两处。
