# WordTap 品牌 SVG

`wordtap-brand.svg` 是浅色背景使用的完整横向标识，包含原有彩色图标、WordTap.cn 字标和“粘贴英文，点词听读”标语。

- 原始画布：278 × 96，背景透明，缩放时保持宽高比。
- Itim 字标与楷体标语已转为矢量路径，不依赖使用者安装字体。
- 原有 256 × 256 PNG 图标完整内嵌，无外部图片或网络依赖；图标本身仍为位图。
- 独立打开 SVG 时可点击跳转官网。作为 HTML 图片使用时，请在图片外包裹链接。
- 转曲版本用于视觉复用，文字不能像网页文字一样选中复制；网页继续保留现有文本组件。

```html
<a href="https://wordtap.cn">
  <img src="/brand/wordtap-brand.svg"
       alt="WordTap.cn — 粘贴英文，点词听读"
       width="278" height="96"
       style="max-width: 100%; height: auto;">
</a>
```

导出脚本为 `tools/export-brand-svg.py`，需要 Python fontTools。英文使用仓库现有 Itim，中文使用本机楷体文件，仅导出字形轮廓，不分发字体文件：

```powershell
python tools/export-brand-svg.py --tagline-font C:/Windows/Fonts/simkai.ttf
```

此资源独立于网页文本组件。调整品牌样式后，应同步重新导出并检查图标、字形、颜色、留白及缩放效果。
