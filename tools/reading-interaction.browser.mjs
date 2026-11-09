// Run against a local preview. WORDTAP_PLAYWRIGHT_MODULE may point to an existing
// Playwright installation; no browser/test dependency is added to the application.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = createRequire(import.meta.url)(process.env.WORDTAP_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.WORDTAP_TEST_URL || 'http://127.0.0.1:5174';
const output = pathToFileURL(path.resolve(process.env.WORDTAP_TEST_OUTPUT || 'tmp/reading-follow') + path.sep);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = [];
const article = Array.from({ length: 28 }, (_, index) => `Paragraph ${index + 1} begins here. Another sentence follows here.`).join('\n\n');
try {
  for (const width of (process.env.WORDTAP_TEST_WIDTHS?.split(',').map(Number) || [1440, 390, 360])) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1000 : 844 },
      isMobile: width < 768, hasTouch: width < 768, deviceScaleFactor: 1, colorScheme: theme });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
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
    });
    await page.route('http://127.0.0.1:18765/**', route => route.abort());
    await page.goto(base);
    await page.locator('textarea').fill(article);
    await page.waitForFunction(() => document.querySelectorAll('[data-sentence-id]').length === 56);
    const reader = page.locator('[data-testid="study-text"]');
    await reader.scrollIntoViewIfNeeded();
    const menu = page.locator('[data-testid="reading-selection-menu"]');
    const select = async (start, end, reverse = false) => {
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
      await menu.waitFor({ state: 'visible' });
    };
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

    await select(1, 9);
    await page.screenshot({ path: fileURLToPath(new URL(`${width}-${theme}-selection.png`, output)) });
    await menu.getByRole('button', { name: '朗读', exact: true }).click();
    await page.waitForFunction(() => window.__spoken.length === 1);
    assert.equal(await page.evaluate(() => window.__spoken[0].text), 'Paragraph 1 begins here.');
    assert.equal(await page.locator('.study-sentence-playing').count(), 0, 'preparation does not bold');
    const geometry = () => page.locator('[data-sentence-id]').first().evaluate(element => Array.from(element.getClientRects()).map(rect => [rect.width, rect.height]));
    const before = await geometry();
    await page.evaluate(() => window.__spoken.at(-1).onstart());
    await page.waitForTimeout(650);
    assert.deepEqual(await geometry(), before, 'paint-only bold does not reflow');
    assert.equal(await page.locator('.study-sentence-playing').count(), 1);
    assert.equal(await page.locator('.study-sentence-playing .study-word-ipa').first().evaluate(element => getComputedStyle(element).webkitTextStrokeWidth), '0px');
    await page.mouse.move(0, 0);
    await page.screenshot({ path: fileURLToPath(new URL(`${width}-${theme}-playing.png`, output)) });
    await page.evaluate(() => window.__spoken.at(-1).onend());
    await page.waitForFunction(() => document.querySelector('.study-fulltext-button').textContent.trim() === '全文朗读');
    assert.equal(await page.evaluate(() => window.__spoken.length), 1, 'selection plays once');

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

    // Holding a selection prevents follow from fighting the user.
    await select(1, 9); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => scrollY), 0);
    await page.keyboard.press('Escape'); await page.waitForTimeout(650);
    assert.equal(await visible(), true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(250);
    assert.equal(await visible(), true, 'reduced-motion follow is immediate after debounce');
    await page.getByRole('button', { name: '停止', exact: true }).evaluate(element => element.click());
    assert.equal(await page.locator('.study-sentence-playing').count(), 0);

    // A constrained reading surface needs both its own scroll and the page's scroll.
    await reader.evaluate(element => { element.style.maxHeight = '240px'; element.style.minHeight = '0'; });
    await reader.scrollIntoViewIfNeeded();
    const lastParagraph = article.lastIndexOf('Paragraph 28');
    await select(lastParagraph + 1, lastParagraph + 9);
    await menu.getByRole('button', { name: '朗读', exact: true }).click();
    await page.evaluate(() => window.__spoken.at(-1).onstart());
    await page.waitForTimeout(650);
    assert.equal(await reader.evaluate(element => {
      const target = element.querySelector('.study-sentence-playing').getBoundingClientRect();
      const box = element.getBoundingClientRect();
      return element.scrollTop > 0 && target.top >= box.top + 23 && target.bottom <= box.bottom - 23;
    }), true, 'nested scroll keeps the sentence inside the reader');
    await page.evaluate(() => window.__spoken.at(-1).onend());
    await page.waitForFunction(() => document.querySelector('.study-fulltext-button').textContent.trim() === '全文朗读');
    await select(lastParagraph + 1, lastParagraph + 9);
    await page.locator('textarea').fill('Changed text.');
    await menu.waitFor({ state: 'hidden' });
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
    assert.deepEqual(errors, []);
    results.push({ width, theme, checks: ['exact-copy', 'reverse-cross-paragraph', 'clipboard-failure', 'phonetics-original-offsets',
      'menu-bounds', 'selection-once', 'actual-sound-bold', 'no-reflow', 'ipa-regular', 'fulltext-follow', 'manual-scroll',
      'pause-resume', 'selection-suspends-follow', 'reduced-motion', 'stop-clears', 'no-overflow', 'ipa-selection-rejected',
      'keyboard-menu', 'nested-scroll', 'edit-closes-menu', 'long-sentence'], errors });
    console.log(`PASS ${width}px ${theme}`);
    await context.close();
  }
  await fs.writeFile(new URL('browser-results.json', output), JSON.stringify({ simulatedSpeech: true, physicalPhone: false, results }, null, 2));
} finally {
  await browser.close();
}
