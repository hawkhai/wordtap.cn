import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.WORDTAP_PLAYWRIGHT_MODULE || "playwright");
const base = process.env.WORDTAP_TEST_URL || "http://127.0.0.1:5173/";
const output = process.env.WORDTAP_TEST_OUTPUT || path.resolve("tmp/mobile-study");
const article = "Mobile reading starts here. This saved article can be restored.";
const courseLink = new URL("?l=nce:1-001", base).href;
const safariMacUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const safariPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const browser = await chromium.launch({ channel: "chrome", headless: true });
await fs.mkdir(output, { recursive: true });

const results = [];
try {
  for (const [width, height, theme, device] of [
    [360, 740, "light"], [390, 844, "dark"], [767, 844, "light"], [768, 844, "light"],
    [844, 390, "light", "phone"], [744, 1133, "light", "ipad"],
    [820, 1180, "light", "ipad"], [1180, 820, "dark", "ipad"], [1440, 900, "light"],
  ]) {
    const ipad = device === "ipad";
    const mobile = width < 768 || !!device;
    const userAgent = device === "phone" ? safariPhoneUserAgent
      : ipad || width === 768 ? safariMacUserAgent : undefined;
    const context = await browser.newContext({
      viewport: { width, height }, isMobile: mobile, hasTouch: mobile, colorScheme: theme, userAgent,
    });
    const page = await context.newPage();
    if (ipad) {
      await page.addInitScript(() => Object.defineProperty(navigator, "maxTouchPoints", { value: 5 }));
    }
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("http://127.0.0.1:18765/**", route => route.abort());
    await page.route("https://hm.baidu.com/**", route => route.abort());
    await page.addInitScript(() => {
      window.__spoken = [];
      window.SpeechSynthesisUtterance = class {
        constructor(text) { this.text = text; }
      };
      Object.defineProperty(window, "speechSynthesis", { value: {
        getVoices: () => [],
        speak(utterance) {
          window.__spoken.push(utterance.text);
          if (window.__holdSpeechStart) window.__pendingSpeechStart = () => utterance.onstart?.();
          else utterance.onstart?.();
        },
        cancel() {}, pause() {}, resume() {},
      } });
    });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    const reader = page.getByTestId("study-text");
    const firstWord = reader.locator(".study-word").first();
    await firstWord.waitFor();
    await page.evaluate(() => document.fonts.ready);
    const firstWordY = Math.round((await firstWord.boundingBox()).y);
    const checkOverflow = async () => assert.equal(await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    ), true, `page fits ${width}px`);
    await checkOverflow();
    assert.equal(await page.locator(".study-mobile-shell").count(), mobile ? 1 : 0);
    assert.equal(await page.locator(".study-mobile-shell-tablet").count(), ipad ? 1 : 0);
    assert.equal(await page.locator(".study-word-card").count(), mobile ? 0 : 1);
    const result = { width, height, theme, ipad, firstWordY, errors };
    results.push(result);

    if (width === 1440) await page.screenshot({ path: path.join(output, "1440-desktop.png") });
    if (device === "phone") {
      assert.equal(await page.locator(".study-reading-surface").evaluate(el =>
        getComputedStyle(el).paddingInlineStart
      ), "16px");
    }
    if (ipad) {
      const surface = page.locator(".study-reading-surface");
      const surfaceBox = await surface.boundingBox();
      const navBox = await page.locator(".study-mobile-nav-row").boundingBox();
      assert.equal(await surface.evaluate(el => getComputedStyle(el).paddingInlineStart), "24px");
      assert.equal(surfaceBox.x, navBox.x);
      assert.equal(surfaceBox.width, navBox.width);
      assert.equal(surfaceBox.x * 2 + surfaceBox.width, width, "tablet work area is centered");
      assert.ok(surfaceBox.width <= 832, "landscape work area stays readable");
    }
    if (width === 360 || width === 390 || ipad) {
      assert.ok(firstWordY <= 420, `first word starts at ${firstWordY}px`);
      assert.equal(await page.evaluate(() => scrollY), 0);
      assert.equal(await page.locator(".study-mobile-learning .study-button-primary").count(), 0);
      assert.equal(await page.getByRole("button", { name: "停止", exact: true }).count(), 0);
      assert.equal(await page.getByRole("button", { name: "编辑文章", exact: true }).count(), 0);
      assert.equal(await page.getByRole("checkbox", { name: "显示音标", exact: true }).count(), 0);
      assert.equal(await page.locator(".study-mobile-nav-row").evaluate((row, gap) => {
        const nav = row.querySelector("nav").getBoundingClientRect();
        const more = row.querySelector(".study-mobile-more").getBoundingClientRect();
        return more.left - nav.right === gap && nav.top === more.top && nav.bottom === more.bottom && more.height >= 44;
      }, ipad ? 8 : 0), true, "More shares the navigation row and keeps its touch height");
      assert.deepEqual(await page.locator(".study-reading-surface").evaluate(surface => {
        const bounds = selector => surface.querySelector(selector).getBoundingClientRect();
        const title = bounds("#study-title");
        const feedback = bounds(".study-mobile-feedback");
        const play = bounds(".study-fulltext-button");
        const reader = bounds(".study-reader");
        const course = bounds(".study-mobile-reading-head .study-mobile-end-action");
        const tools = bounds(".study-mobile-reading-actions .study-mobile-end-action");
        return {
          readingStart: [play.left, feedback.left, reader.left].every(left => left === title.left),
          actionEnd: course.right === tools.right,
          playbackRow: play.top === tools.top && play.bottom === tools.bottom,
        };
      }), { readingStart: true, actionEnd: true, playbackRow: true });
      await page.screenshot({ path: path.join(output, `${width}-reader.png`) });
      const play = page.locator(".study-fulltext-button");
      const hitArea = () => play.evaluate(button => ({ width: button.offsetWidth, height: button.offsetHeight }));
      const idleHitArea = await hitArea();
      assert.ok(idleHitArea.height >= 44);
      assert.equal(await play.evaluate(button => {
        const label = button.querySelector(".study-mobile-speech-label");
        const face = label.getBoundingClientRect();
        const faceStyle = getComputedStyle(label);
        return face.height === 32 && face.width <= 80 && faceStyle.borderTopWidth === "1px" &&
          faceStyle.borderTopStyle === "solid" && getComputedStyle(button).backgroundColor === "rgba(0, 0, 0, 0)";
      }), true, "compact outlined speech button inside the full touch area");
      await firstWord.tap();
      assert.equal(await page.locator(".study-word-popover-word").textContent(), await firstWord.textContent());
      const lookup = page.locator(".study-word-popover-mobile");
      if (ipad) {
        const lookupBox = await lookup.boundingBox();
        assert.ok(lookupBox.width <= 512 && lookupBox.x * 2 + lookupBox.width === width);
        assert.equal(Math.round(lookupBox.y + lookupBox.height), height - 24);
      } else {
        assert.equal(await lookup.evaluate(popover => {
          const reader = document.querySelector(".study-reading-surface").getBoundingClientRect();
          const lookup = popover.getBoundingClientRect();
          return reader.left === lookup.left && reader.right === lookup.right;
        }), true, "word lookup follows the page margins");
      }
      await page.keyboard.press("Escape");
      await page.evaluate(() => { window.__holdSpeechStart = true; });
      await play.tap();
      await play.getByText("准备中…", { exact: true }).waitFor();
      assert.deepEqual(await hitArea(), idleHitArea);
      await page.waitForFunction(() => typeof window.__pendingSpeechStart === "function");
      await page.evaluate(() => {
        window.__holdSpeechStart = false;
        window.__pendingSpeechStart();
      });
      await play.getByText("暂停", { exact: true }).waitFor();
      await play.tap();
      await play.getByText("继续", { exact: true }).waitFor();
      assert.deepEqual(await hitArea(), idleHitArea);
      await play.tap();
      await play.getByText("暂停", { exact: true }).waitFor();
      await page.getByRole("button", { name: "停止", exact: true }).tap();
      await play.getByText("全文朗读", { exact: true }).waitFor();
      const toolsTrigger = page.getByRole("button", { name: "文章工具", exact: true });
      const articleTools = page.getByRole("dialog", { name: "文章工具", exact: true });
      await toolsTrigger.tap();
      await articleTools.getByRole("checkbox", { name: "显示音标" }).check();
      if (width === 390) await page.screenshot({ path: path.join(output, "390-article-tools.png") });
      await page.keyboard.press("Escape");
      await articleTools.waitFor({ state: "hidden" });
      await toolsTrigger.tap();
      assert.equal(await articleTools.getByRole("checkbox", { name: "显示音标" }).isChecked(), true);
      await articleTools.getByRole("checkbox", { name: "显示音标" }).uncheck();
      await articleTools.getByRole("button", { name: "文章跟打", exact: true }).tap();
      await page.getByRole("heading", { name: "文章跟打", exact: true }).waitFor();
      await toolsTrigger.tap();
      await articleTools.getByRole("checkbox", { name: "自动朗读新句" }).waitFor();
      await articleTools.getByRole("button", { name: "关闭", exact: true }).tap();
      await page.getByRole("button", { name: "退出跟打", exact: true }).tap();
      await firstWord.waitFor();

      const courseTrigger = page.getByRole("button", { name: "选课程", exact: true });
      const courses = page.getByRole("dialog", { name: "选课程", exact: true });
      await courseTrigger.tap();
      const courseButtons = courses.locator("[data-course-dropdown] > button");
      await courseButtons.nth(8).waitFor();
      assert.equal(await courseButtons.count(), 9);
      for (const button of await courseButtons.all()) {
        await button.tap();
        const menu = courses.locator(".nce-panel");
        await menu.waitFor();
        assert.equal(await menu.evaluate(panel => {
          const dialog = panel.closest("dialog").getBoundingClientRect();
          const bounds = panel.getBoundingClientRect();
          return bounds.left >= dialog.left && bounds.right <= dialog.right && panel.scrollWidth <= panel.clientWidth;
        }), true, `course menu fits ${width}px: ${await button.textContent()}`);
        await checkOverflow();
        await button.tap();
        await menu.waitFor({ state: "hidden" });
      }
      await page.keyboard.press("Escape");
      await courses.waitFor({ state: "hidden" });
      await page.waitForFunction(() => document.activeElement?.textContent.trim() === "选课程");
      await courseTrigger.tap();
      await courses.getByRole("button", { name: /新概念英语/ }).tap();
      if (width === 390) await page.screenshot({ path: path.join(output, "390-courses.png") });
      await courses.getByRole("button", { name: /打扰一下！.*Excuse Me/ }).first().tap();
      await courses.waitFor({ state: "hidden" });
      await page.waitForFunction(() => document.activeElement?.id === "study-title");
      assert.match(await reader.textContent(), /Excuse me/i);
      assert.equal(new URL(page.url()).searchParams.get("l"), "nce:1-001");
      await page.goto(courseLink);
      await firstWord.waitFor();
      assert.match(await reader.textContent(), /Excuse me/i);

      const moreTrigger = page.getByRole("button", { name: "更多", exact: true });
      await moreTrigger.tap();
      const more = page.getByRole("dialog", { name: "更多" });
      assert.equal(await more.locator("details").getAttribute("open"), null);
      await more.getByText("查词与朗读设置", { exact: true }).tap();
      await more.getByLabel("语速").waitFor();
      assert.equal(await more.locator(".study-mobile-field select").evaluateAll(selects => {
        const edges = selects.map(select => select.getBoundingClientRect());
        return edges.length === 6 && edges.every(edge => edge.left === edges[0].left && edge.right === edges[0].right);
      }), true, "settings share a control column");
      if (ipad) {
        assert.equal(await more.locator(".study-mobile-field select").evaluateAll(selects =>
          selects.every(select => select.getBoundingClientRect().height >= 44)
        ), true, "tablet settings retain touch-sized fields");
        await checkOverflow();
      }
      if (width === 390) await page.screenshot({ path: path.join(output, "390-settings.png") });
      await more.getByLabel("主题").selectOption(theme === "light" ? "dark" : "light");
      assert.equal(await page.locator("html").getAttribute("data-theme"), theme === "light" ? "dark" : "light");
      await more.getByRole("button", { name: "关闭", exact: true }).tap();
      await page.waitForFunction(() => document.activeElement?.textContent.trim() === "更多");
      for (const name of ["我的单词", "国际音标", "开始学习"]) {
        await page.getByRole("button", { name, exact: true }).tap();
      }

      async function openEditor() {
        await toolsTrigger.tap();
        await articleTools.getByRole("button", { name: "编辑文章", exact: true }).tap();
      }
      await openEditor();
      const editor = page.getByRole("dialog", { name: "编辑文章" });
      const source = editor.getByRole("textbox", { name: "文章正文" });
      const done = editor.getByRole("button", { name: "完成", exact: true });
      assert.deepEqual(await editor.evaluate(dialog => {
        const bounds = selector => dialog.querySelector(selector).getBoundingClientRect();
        const input = bounds("textarea");
        const history = bounds("#text-history-select");
        const remove = bounds(".study-mobile-editor-history button");
        const done = bounds("header button");
        return [input.left === history.left, remove.right === input.right && done.right === input.right,
          history.top === remove.top && history.bottom === remove.bottom];
      }), [true, true, true], "editor fields and actions share the dialog edges");
      assert.equal(await editor.getByRole("button", { name: "网址", exact: true }).isEnabled(), true);
      await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(base).origin });
      await page.evaluate(text => navigator.clipboard.writeText(text), article);
      await source.press("ControlOrMeta+A");
      await source.press("ControlOrMeta+V");
      assert.equal(await source.inputValue(), article);
      await page.evaluate(() => {
        Object.defineProperty(visualViewport, "height", { value: 380, configurable: true });
        Object.defineProperty(visualViewport, "offsetTop", { value: 40, configurable: true });
        visualViewport.dispatchEvent(new Event("resize"));
      });
      const keyboardBounds = await editor.boundingBox();
      assert.ok(keyboardBounds.y >= 40 && keyboardBounds.y + keyboardBounds.height <= 420);
      const doneBounds = await done.boundingBox();
      assert.ok(doneBounds.y >= 40 && doneBounds.y + doneBounds.height <= 420);
      if (width === 390) await page.screenshot({ path: path.join(output, "390-editor-keyboard-area.png") });
      await done.tap();
      await page.waitForFunction(() => document.activeElement?.textContent.trim() === "文章工具");
      await page.waitForFunction(text => document.querySelector('[data-testid="study-text"]')?.textContent === text, article);
      await openEditor();
      await editor.locator("#text-history-select option").nth(1).waitFor({ state: "attached" });
      assert.equal(await source.inputValue(), article);
      await page.touchscreen.tap(1, 1);
      await editor.waitFor({ state: "hidden" });
      await page.waitForFunction(() => document.activeElement?.textContent.trim() === "文章工具");
      await page.goto(base);
      await firstWord.waitFor();
      assert.equal(await reader.textContent(), article);
    }
    assert.deepEqual(errors, []);
    console.log(`PASS ${width} × ${height} ${theme} (first word ${firstWordY}px)`);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => localStorage.setItem("wordtap.defaultTextRunCount", "3"));
  const page = await context.newPage();
  await page.goto(base);
  const paste = page.getByRole("button", { name: "粘贴文章", exact: true });
  await paste.tap();
  assert.equal(await page.getByTestId("study-text").count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "文章正文");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.textContent.trim() === "粘贴文章");
  await page.goto(new URL("?l=nce:1-999", base).href);
  await page.getByTestId("status-text").filter({ hasText: "课程链接" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "选课程", exact: true }).isEnabled(), true);
  await context.close();
  await fs.writeFile(path.join(output, "browser-results.json"), JSON.stringify({ simulatedKeyboardViewport: true, simulatedSpeech: true, results }, null, 2));
} finally {
  await browser.close();
}
