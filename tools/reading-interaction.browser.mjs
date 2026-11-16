// Run against a local server. WORDTAP_PLAYWRIGHT_MODULE may point to an existing
// Playwright installation; no browser/test dependency is added to the application.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const { chromium } = createRequire(import.meta.url)(process.env.WORDTAP_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.WORDTAP_TEST_URL || 'http://127.0.0.1:5174';
const output = process.env.WORDTAP_TEST_OUTPUT || path.resolve('tmp/reading-follow');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = [];
const article = Array.from({ length: 28 }, (_, index) => `Paragraph ${index + 1} begins here. Another sentence follows here.`).join('\n\n');
try {
  for (const width of (process.env.WORDTAP_TEST_WIDTHS?.split(',').map(Number) || [1440, 1024, 390, 360])) for (const theme of ['light', 'dark']) {
    const hasTouch = width <= 1024;
    const hideCoarsePointer = width === 1024;
    const hideTouchPoints = hideCoarsePointer && theme === 'dark';
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1000 : 844 },
      isMobile: width < 768, hasTouch, deviceScaleFactor: 1, colorScheme: theme });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ hideCoarsePointer, hideTouchPoints }) => {
      if (hideCoarsePointer) {
        const matchMedia = window.matchMedia.bind(window);
        window.matchMedia = query => matchMedia(query === '(any-pointer: coarse)' ? '(width: 0px)' : query);
      }
      if (hideTouchPoints) Object.defineProperty(navigator, 'maxTouchPoints', { value: 0 });
      window.__spoken = [];
      window.__copied = '';
      window.__copyFails = false;
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      Object.defineProperty(window, 'speechSynthesis', { value: {
        getVoices: () => [], speak: utterance => { if (utterance.text) window.__spoken.push(utterance); },
        cancel() {}, pause() {}, resume() {},
      } });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => {
        if (window.__copyFails) throw new Error('simulated clipboard denial');
        window.__copied = text;
      } } });
    }, { hideCoarsePointer, hideTouchPoints });
    await page.route('http://127.0.0.1:18765/**', route => route.abort());
    await page.route('https://hm.baidu.com/**', route => route.abort());
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const reader = page.locator('[data-testid="study-text"]');
    await reader.locator('[data-sentence-id]').first().waitFor();
    await page.locator('textarea').fill(article);
    await page.waitForFunction(() => document.querySelectorAll('[data-sentence-id]').length === 56);
    await reader.scrollIntoViewIfNeeded();
    const menu = page.locator('[data-testid="reading-selection-menu"]');
    const paragraphs = reader.locator('.study-paragraph-button');
    const sentenceButton = index => reader.locator('[data-sentence-id]').nth(index)
      .locator('.study-sentence-button:not(.study-paragraph-button)');
    const setSelection = async (start, end, reverse = false) => {
      await page.evaluate(({ start, end, reverse }) => {
        const tokens = Array.from(document.querySelectorAll('[data-source-start]')).filter(element => element.firstChild?.nodeType === 3);
        const point = offset => {
          const token = tokens.find(element => Number(element.dataset.sourceStart) <= offset &&
            Number(element.dataset.sourceStart) + element.textContent.length >= offset);
          if (!token) throw new Error(`No original node for ${offset}`);
          return [token.firstChild, offset - Number(token.dataset.sourceStart)];
        };
        const a = point(start), b = point(end);
        getSelection().setBaseAndExtent(...(reverse ? b : a), ...(reverse ? a : b));
      }, { start, end, reverse });
    };
    const select = async (start, end, reverse = false) => {
      await setSelection(start, end, reverse);
      await menu.waitFor({ state: 'visible' });
    };
    if (hasTouch) {
      if (hideTouchPoints) {
        assert.equal(await paragraphs.count(), 0);
        await select(1, 9);
        await reader.dispatchEvent('touchstart');
        await menu.waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => getSelection().toString()), article.slice(1, 9));
      }
      assert.equal(await paragraphs.count(), 28);
      assert.equal(await reader.locator('[data-sentence-id]').count(), 56);
      const geometry = () => paragraphs.first().evaluate(button => {
        const box = button.getBoundingClientRect();
        return { width: box.width, height: box.height, source: button.nextElementSibling.querySelector('[data-source-start]')?.dataset.sourceStart };
      });
      assert.deepEqual(await geometry(), { width: 24, height: 24, source: '0' });
      assert.equal(await paragraphs.first().locator('svg').innerHTML(), await sentenceButton(0).locator('svg').innerHTML());
      assert.equal(await paragraphs.first().locator('svg').evaluate(svg => getComputedStyle(svg).width), '24px');
      assert.equal(await sentenceButton(0).locator('svg').evaluate(svg => getComputedStyle(svg).width), '16px');
      await paragraphs.first().scrollIntoViewIfNeeded();
      const touchLayout = await paragraphs.first().evaluate(button => {
        const style = getComputedStyle(button);
        const readerStyle = getComputedStyle(button.closest('.study-reader'));
        const bounds = button.getBoundingClientRect();
        const glyph = button.querySelector('svg').getBoundingClientRect();
        const firstWord = button.nextElementSibling.querySelector('.study-word');
        const wordBounds = firstWord.getBoundingClientRect();
        const gap = wordBounds.left - bounds.right;
        const glyphShift = (glyph.top + glyph.bottom - bounds.top - bounds.bottom) / 2;
        const hit = box => document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest('button');
        return {
          textSized: style.fontSize === readerStyle.fontSize && bounds.height <= parseFloat(readerStyle.lineHeight),
          glyphAligned: Math.abs(glyphShift - 0.05 * parseFloat(style.fontSize)) < 0.1,
          gap: parseFloat(style.marginLeft) === 0 && gap >= 0 && gap < 5,
          toggleHit: hit(bounds) === button,
          wordHit: hit(wordBounds) === firstWord,
        };
      });
      assert.deepEqual(touchLayout, { textSized: true, glyphAligned: true, gap: true, toggleHit: true, wordHit: true });
      const anchors = () => paragraphs.evaluateAll(buttons => buttons.map(button => [button.offsetLeft, button.offsetTop]));
      await page.evaluate(() => document.fonts.ready);
      const initialAnchors = await anchors();
      for (const [start, end, reverse] of [[1, 9, false], [3, 12, true], [12, 83, true], [2, 8, false]]) {
        await setSelection(start, end, reverse);
        const nativeRange = () => page.evaluate(() => {
          const selection = getSelection();
          return [selection.anchorNode.parentElement.dataset.sourceStart, selection.anchorOffset,
            selection.focusNode.parentElement.dataset.sourceStart, selection.focusOffset, selection.toString()];
        });
        const expected = await nativeRange();
        await page.waitForTimeout(200);
        assert.deepEqual(await nativeRange(), expected);
        assert.deepEqual(await anchors(), initialAnchors);
        assert.equal(await page.locator('.study-selection-menu').count(), 0);
      }
      await page.evaluate(() => getSelection().removeAllRanges());

      await paragraphs.first().tap();
      await page.waitForFunction(() => window.__spoken.length === 1);
      assert.match(await paragraphs.first().getAttribute('aria-label'), /正在准备朗读本段/);
      const clockHand = paragraphs.first().locator('.study-speaker-clock-hand');
      assert.deepEqual(await clockHand.evaluate(path => {
        const style = getComputedStyle(path);
        return [style.animationName, style.animationTimingFunction];
      }), ['study-speaker-clock-turn', 'linear']);
      assert.equal(await paragraphs.first().locator('svg circle').count(), 1, 'preparation shows a clock face');
      assert.deepEqual(await geometry(), { width: 24, height: 24, source: '0' });
      await paragraphs.first().tap();
      assert.equal(await paragraphs.first().getAttribute('aria-pressed'), 'false', 'second tap stops a preparing paragraph');
      await page.evaluate(() => { window.__spoken.at(-1).onend?.(); window.__spoken = []; });

      await paragraphs.first().tap();
      for (const [index, sentence] of ['Paragraph 1 begins here.', 'Another sentence follows here.'].entries()) {
        await page.waitForFunction(count => window.__spoken.length === count, index + 1);
        assert.equal(await page.evaluate(() => window.__spoken.at(-1).text), sentence);
        if (index === 1) {
          const hourglass = paragraphs.first().locator('.study-speaker-hourglass');
          await hourglass.waitFor({ state: 'attached' });
          assert.match(await paragraphs.first().getAttribute('aria-label'), /正在等待本段后续音频/);
          assert.equal(await clockHand.count(), 0);
          const grains = hourglass.locator('.study-speaker-sand-stream > circle');
          assert.deepEqual(await grains.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).animationDelay)),
            ['0s', '-0.19s', '-0.38s']);
          if (width === 390) {
            const levels = await hourglass.locator('.study-speaker-sand').evaluateAll(nodes => nodes.map(node => {
              const animation = node.getAnimations()[0];
              animation.pause();
              animation.currentTime = 0;
              const initial = new DOMMatrix(getComputedStyle(node).transform).d;
              animation.currentTime = 1500;
              return [initial, new DOMMatrix(getComputedStyle(node).transform).d];
            }));
            assert.ok(levels[0][1] < levels[0][0], 'upper chamber drains');
            assert.ok(levels[1][1] > levels[1][0], 'lower chamber fills');
            await page.emulateMedia({ reducedMotion: 'reduce' });
            assert.equal(await hourglass.evaluate(node => node.getAnimations({ subtree: true }).length), 0);
            await page.emulateMedia({ reducedMotion: 'no-preference' });
          }
        }
        await page.evaluate(() => window.__spoken.at(-1).onstart());
        assert.match(await paragraphs.first().getAttribute('aria-label'), /正在朗读本段，点击停止/);
        assert.equal(await clockHand.count(), 0);
        assert.equal(await paragraphs.first().locator('.study-speaker-hourglass').count(), 0);
        if (index === 0) {
          const waves = paragraphs.first().locator('.study-speaker-wave');
          assert.deepEqual(await waves.evaluateAll(paths => paths.map(path => getComputedStyle(path).animationDelay)), ['0s', '0.24s']);
          assert.deepEqual(await paragraphs.first().evaluate(button => {
            const style = getComputedStyle(button);
            return [style.backgroundColor, style.borderTopWidth];
          }), ['rgba(0, 0, 0, 0)', '0px']);
          if (width === 390) {
            await page.emulateMedia({ reducedMotion: 'reduce' });
            assert.deepEqual(await waves.evaluateAll(paths => paths.map(path => path.getAnimations().length)), [0, 0]);
            await page.emulateMedia({ reducedMotion: 'no-preference' });
          }
          await page.locator('.study-fulltext-button').evaluate(button => button.click());
          assert.equal((await page.locator('.study-fulltext-button').textContent()).trim(), '继续');
          assert.equal(await paragraphs.first().getAttribute('aria-pressed'), 'true');
          assert.match(await paragraphs.first().getAttribute('aria-label'), /本段朗读已暂停，点击停止/);
          await page.locator('.study-fulltext-button').evaluate(button => button.click());
          assert.equal((await page.locator('.study-fulltext-button').textContent()).trim(), '暂停');
          assert.match(await paragraphs.first().getAttribute('aria-label'), /正在朗读本段，点击停止/);
        }
        await page.evaluate(() => window.__spoken.at(-1).onend());
      }
      await page.waitForFunction(() => !document.querySelector('.study-paragraph-button[aria-pressed="true"]'));
      assert.match(await paragraphs.first().getAttribute('aria-label'), /^朗读本段/);
      assert.equal(await page.evaluate(() => window.__spoken.length), 2, 'paragraph ends after one pass');
      await page.evaluate(() => { window.__spoken = []; });

      await paragraphs.first().tap();
      await page.waitForFunction(() => window.__spoken.length === 1);
      await page.evaluate(() => window.__spoken.at(-1).onstart());
      await paragraphs.nth(1).tap();
      assert.equal(await paragraphs.first().getAttribute('aria-pressed'), 'false');
      assert.equal(await paragraphs.nth(1).getAttribute('aria-pressed'), 'true');
      await page.waitForFunction(() => window.__spoken.length === 2);
      assert.equal(await page.evaluate(() => window.__spoken.at(-1).text), 'Paragraph 2 begins here.');
      await page.evaluate(() => window.__spoken[0].onend?.());
      await paragraphs.nth(1).tap();
      assert.equal(await paragraphs.nth(1).getAttribute('aria-pressed'), 'false');
      assert.equal(await page.evaluate(() => window.__spoken.length), 2, 'switching abandons the previous queue');
      await page.evaluate(() => { window.__spoken = []; });
    } else {
      assert.equal(await paragraphs.count(), 0);
      // Exact copy survives reverse/cross-paragraph selections and excludes IPA.
      for (const [start, end, reverse] of [[1, 9, false], [12, 83, true]]) {
        await select(start, end, reverse);
        await menu.getByRole('button', { name: '复制', exact: true }).click();
        assert.equal(await page.evaluate(() => window.__copied), article.slice(start, end));
      }
      await select(1, 9);
      await page.evaluate(() => { window.__copyFails = true; });
      await menu.getByRole('button', { name: '复制', exact: true }).click();
      assert.equal(await page.evaluate(() => getSelection().toString()), article.slice(1, 9));
      await page.keyboard.press('Escape');
      await menu.waitFor({ state: 'hidden' });
      await page.evaluate(() => { window.__copyFails = false; });
    }

    // A real desktop mouse drag must not invoke the button's word click handler.
    if (width === 1440) {
      await reader.scrollIntoViewIfNeeded();
      const points = await page.evaluate(() => {
        const node = document.querySelector('.study-word .study-source-text').firstChild;
        const a = document.createRange(); a.setStart(node, 1); a.setEnd(node, 2);
        const b = document.createRange(); b.setStart(node, 6); b.setEnd(node, 7);
        const first = a.getBoundingClientRect(), last = b.getBoundingClientRect();
        return { x:first.left + 1, y:first.top + first.height / 2, end:last.right - 1 };
      });
      await page.mouse.move(points.x, points.y); await page.mouse.down();
      await page.mouse.move(points.end, points.y, { steps: 12 }); await page.mouse.up();
      await menu.waitFor({ state: 'visible' });
      assert.equal(await page.locator('.study-word-selected').count(), 0);
      assert.equal(await page.evaluate(() => window.__spoken.length), 0);
      await page.keyboard.press('Escape');
    }

    await page.getByRole('checkbox', { name: '显示音标', exact: true }).check();
    await page.locator('.study-word-ipa').first().waitFor();
    await reader.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const node = document.querySelector('.study-word-ipa').firstChild;
      getSelection().setBaseAndExtent(node, 0, node, node.textContent.length);
    });
    await page.waitForTimeout(250);
    assert.equal(await menu.count(), 0, 'IPA alone is not an original-text selection');
    if (!hasTouch) {
      await select(1, 9);
      const menuBox = await menu.boundingBox();
      assert.ok(menuBox.x >= 0 && menuBox.x + menuBox.width <= width, 'menu fits viewport');
      await menu.getByRole('button', { name: '复制', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__copied), article.slice(1, 9));
      await select(1, 9);
      await menu.getByRole('button', { name: '复制', exact: true }).focus();
      await page.keyboard.press('Enter');
      await menu.waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => document.activeElement.dataset.testid), 'study-text', 'keyboard focus returns to reader');
    }

    if (!hasTouch) await select(1, 9);
    await page.screenshot({ path: path.join(output, `${width}-${theme}-selection.png`) });
    if (hasTouch) await sentenceButton(0).tap();
    else await menu.getByRole('button', { name: '朗读', exact: true }).click();
    await page.waitForFunction(() => window.__spoken.length === 1);
    assert.equal(await page.evaluate(() => window.__spoken[0].text), 'Paragraph 1 begins here.');
    if (hasTouch) assert.match(await sentenceButton(0).getAttribute('aria-label'), /正在准备朗读本句/);
    assert.equal(await page.locator('.study-sentence-playing').count(), 0, 'preparation does not bold');
    const geometry = () => page.locator('[data-sentence-id]').first().evaluate(element => Array.from(element.getClientRects()).map(rect => [rect.width, rect.height]));
    const before = await geometry();
    await page.evaluate(() => window.__spoken.at(-1).onstart());
    await page.waitForTimeout(650);
    assert.deepEqual(await geometry(), before, 'paint-only bold does not reflow');
    if (hasTouch) assert.match(await sentenceButton(0).getAttribute('aria-label'), /正在朗读本句，点击停止/);
    assert.equal(await page.locator('.study-sentence-playing').count(), 1);
    assert.equal(await page.locator('.study-sentence-playing .study-word-ipa').first().evaluate(element => getComputedStyle(element).webkitTextStrokeWidth), '0px');
    await page.mouse.move(0, 0);
    await page.screenshot({ path: path.join(output, `${width}-${theme}-playing.png`) });
    await page.evaluate(() => window.__spoken.at(-1).onend());
    await page.waitForFunction(() => document.querySelector('.study-fulltext-button').textContent.trim() === '全文朗读');
    await page.locator('.study-sentence-playing').waitFor({ state: 'hidden' });
    if (hasTouch) assert.match(await sentenceButton(0).getAttribute('aria-label'), /^朗读本句/);
    assert.equal(await page.evaluate(() => window.__spoken.length), 1, 'sentence plays once');

    // Full-text sound events move the sentence and follow it through the document.
    await page.locator('.study-fulltext-button').click();
    await page.waitForFunction(() => window.__spoken.length === 2);
    for (let i = 0; i < 24; i++) {
      await page.evaluate(() => window.__spoken.at(-1).onstart());
      if (i < 23) {
        await page.evaluate(() => window.__spoken.at(-1).onend());
        await page.waitForFunction(count => window.__spoken.length === count, i + 3);
      }
    }
    await page.waitForTimeout(800);
    const visible = () => page.locator('.study-sentence-playing').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.top >= 23 && rect.bottom <= innerHeight - 23;
    });
    assert.equal(await visible(), true, 'current sentence is inside the safe area');
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(850);
    assert.equal(await visible(), true, 'manual scroll returns to current sentence');
    await page.locator('.study-fulltext-button').evaluate(element => element.click());
    const currentId = await page.locator('.study-sentence-playing').getAttribute('data-sentence-id');
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => scrollY), 0, 'pause suspends follow');
    assert.equal(await page.locator('.study-sentence-playing').getAttribute('data-sentence-id'), currentId);
    await page.locator('.study-fulltext-button').evaluate(element => element.click()); await page.waitForTimeout(650);
    assert.equal(await visible(), true, 'resume follows again: ' + JSON.stringify(await page.evaluate(() => ({
      rect: document.querySelector('.study-sentence-playing').getBoundingClientRect().toJSON(),
      scrollY, height:innerHeight, label:document.querySelector('.study-fulltext-button').textContent,
      selection:getSelection().toString(), menu:!!document.querySelector('[data-testid="reading-selection-menu"]'),
    }))));

    // Desktop selection suspends follow until the selection menu is dismissed.
    if (!hasTouch) {
      await select(1, 9);
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(600);
      assert.equal(await page.evaluate(() => scrollY), 0);
      await page.keyboard.press('Escape'); await page.waitForTimeout(650);
      assert.equal(await visible(), true);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(250);
    assert.equal(await visible(), true, 'reduced-motion follow is immediate after debounce');
    await page.getByRole('button', { name: '停止', exact: true }).evaluate(element => element.click());
    assert.equal(await page.locator('.study-sentence-playing').count(), 0);

    // A constrained reading surface needs both its own scroll and the page's scroll.
    await reader.evaluate(element => { element.style.maxHeight = '240px'; element.style.minHeight = '0'; });
    await reader.scrollIntoViewIfNeeded();
    const lastParagraph = article.lastIndexOf('Paragraph 28');
    if (hasTouch) {
      await paragraphs.last().tap();
    } else {
      await select(lastParagraph + 1, lastParagraph + 9);
      await menu.getByRole('button', { name: '朗读', exact: true }).click();
    }
    await page.waitForFunction(() => window.__spoken.at(-1).text.startsWith('Paragraph 28'));
    await page.evaluate(() => window.__spoken.at(-1).onstart());
    await page.waitForTimeout(650);
    assert.equal(await reader.evaluate(element => {
      const target = element.querySelector('.study-sentence-playing').getBoundingClientRect();
      const box = element.getBoundingClientRect();
      return element.scrollTop > 0 && target.top >= box.top + 23 && target.bottom <= box.bottom - 23;
    }), true, 'nested scroll keeps the sentence inside the reader');
    if (hasTouch) {
      await page.evaluate(() => window.__spoken.at(-1).onend());
      await page.waitForFunction(() => window.__spoken.at(-1).text === 'Another sentence follows here.');
      assert.equal(await paragraphs.last().getAttribute('aria-pressed'), 'true');
    } else {
      await page.evaluate(() => window.__spoken.at(-1).onend());
      await page.waitForFunction(() => document.querySelector('.study-fulltext-button').textContent.trim() === '全文朗读');
      await select(lastParagraph + 1, lastParagraph + 9);
    }
    await page.locator('textarea').fill('Changed text.');
    await menu.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.querySelector('.study-fulltext-button').textContent.trim() === '全文朗读');
    assert.equal(await reader.locator('.study-paragraph-button[aria-pressed="true"]').count(), 0);
    assert.equal(await page.locator('.study-sentence-playing').count(), 0);
    await page.locator('textarea').fill(`Long ${'word '.repeat(400)}sentence. End.`);
    await page.waitForFunction(() => document.querySelectorAll('[data-sentence-id]').length === 2);
    await page.locator('.study-fulltext-button').click();
    await page.waitForFunction(() => window.__spoken.at(-1).text.startsWith('Long '));
    await page.evaluate(() => window.__spoken.at(-1).onstart());
    await page.waitForTimeout(650);
    const tallSentence = await reader.evaluate(element => {
      const target = element.querySelector('.study-sentence-playing').getBoundingClientRect();
      const box = element.getBoundingClientRect();
      // At scrollTop=0 the original 8px mobile padding remains; scrolling cannot
      // manufacture 24px of extra space. Verify the entire first line is visible.
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
      return { visible: target.height > element.clientHeight && target.top >= Math.max(23, box.top) &&
        target.top + lineHeight <= Math.min(innerHeight - 23, box.bottom), target:target.toJSON(), box:box.toJSON(),
        height:innerHeight, scrollY, scrollTop:element.scrollTop, clientHeight:element.clientHeight,
        card:document.querySelector('.study-word-card').getBoundingClientRect().toJSON() };
    });
    assert.equal(tallSentence.visible, true, 'a tall sentence keeps its first line visible: ' + JSON.stringify(tallSentence));
    await page.getByRole('button', { name: '停止', exact: true }).evaluate(element => element.click());
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(overflow, false, 'no horizontal page overflow');
    if (hasTouch) {
      await page.locator('textarea').fill('First line.\n第二行，Second line.\n\n中文。\n\n \n...\n\nLast paragraph.');
      await page.waitForFunction(() => document.querySelectorAll('.study-paragraph-button').length === 2);
      await page.locator('textarea').fill('...');
      await page.waitForFunction(() => !document.querySelector('[data-sentence-id], .study-paragraph-button'));
    }
    assert.deepEqual(errors, []);
    const selectionChecks = hasTouch ? ['native-selection', 'stable-layout-during-selection', 'paragraph-once', 'paragraph-switch-stop', 'paragraph-pause-resume', 'paragraph-edit-stop', 'speaker-states', 'readable-paragraph-boundaries', 'text-sized-target'] :
      ['exact-copy', 'reverse-cross-paragraph', 'clipboard-failure', 'phonetics-original-offsets', 'menu-bounds', 'keyboard-menu', 'selection-suspends-follow'];
    if (hideCoarsePointer) selectionChecks.push(hideTouchPoints ? 'touch-event-fallback' : 'touch-points-fallback');
    results.push({ width, theme, checks: [...selectionChecks,
      'sentence-once', 'actual-sound-bold', 'no-reflow', 'ipa-regular', 'fulltext-follow', 'manual-scroll',
      'pause-resume', 'reduced-motion', 'stop-clears', 'no-overflow', 'ipa-selection-rejected',
      'nested-scroll', 'edit-clears-selection', 'long-sentence'], errors });
    console.log(`PASS ${width}px ${theme}`);
    await context.close();
  }
  await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify({ simulatedSpeech: true, physicalPhone: false, results }, null, 2));
} finally {
  await browser.close();
}
