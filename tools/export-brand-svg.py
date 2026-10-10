"""Export the existing brand as a standalone SVG (requires fontTools).

Usage: python tools/export-brand-svg.py --tagline-font C:/Windows/Fonts/simkai.ttf
The supplied font is used for outlines only; no font file is distributed.
"""

import argparse
import base64
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parent.parent


def outline(text, font, size, x, baseline, tracking, fill):
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font['head'].unitsPerEm
    paths = []
    for char in text:
        if ord(char) not in cmap:
            raise ValueError(f'Missing glyph: {char}')
        name = cmap[ord(char)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        paths.append(
            f'<path transform="translate({x:.3f} {baseline}) scale({scale:.8f} {-scale:.8f})" '
            f'd="{pen.getCommands()}"/>'
        )
        x += font['hmtx'][name][0] * scale + tracking
    return f'<g fill="{fill}">' + ''.join(paths) + '</g>', x


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tagline-font', type=Path, required=True)
    args = parser.parse_args()
    with TTFont(ROOT / 'public/fonts/Itim/Itim-Regular.ttf') as latin, TTFont(args.tagline_font) as chinese:
        word, tap_start = outline('Word', latin, 44, 78, 48, -1.76, '#1d2129')
        tap, domain_start = outline('Tap', latin, 44, tap_start, 48, -1.76, '#165dff')
        domain, end = outline('.cn', latin, 22, domain_start + 2.64, 48, -.44, '#4e5969')
        slogan, _ = outline('粘贴英文，点词听读', chinese, 15, 80, 78, 1.8, '#445a84')
    width = round(end + 10)
    icon = base64.b64encode((ROOT / 'public/logo-mark.png').read_bytes()).decode('ascii')
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{width}" height="96" viewBox="0 0 {width} 96" role="img" aria-labelledby="wordtap-title wordtap-description">
  <title id="wordtap-title">WordTap.cn — 粘贴英文，点词听读</title>
  <desc id="wordtap-description">WordTap 品牌标识；文字为矢量轮廓，原有彩色图标为内嵌 PNG，透明背景，无外部资源。</desc>
  <a xlink:href="https://wordtap.cn" aria-label="访问 WordTap.cn">
    <image x="8" y="20" width="56" height="56" xlink:href="data:image/png;base64,{icon}"/>
    {word}
    {tap}
    <path d="M {tap_start + 3.5:.3f} 54 Q {(tap_start + domain_start) / 2:.3f} 55 {domain_start - .4:.3f} 51" fill="none" stroke="#165dff" stroke-width="2.86" stroke-linecap="round" opacity=".55"/>
    {domain}
    {slogan}
  </a>
</svg>
'''
    output = ROOT / 'public/brand/wordtap-brand.svg'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(svg, encoding='utf-8')
    print(f'{output}: {width} x 96, {output.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
