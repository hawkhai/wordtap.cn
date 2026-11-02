import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../public/theme.js", import.meta.url), "utf8");

function browser({ stored = null, dark = false, blocked = false } = {}) {
  const events = { window: {}, document: {}, media: {} };
  const values = new Map(stored === null ? [] : [["wordtap-theme", stored]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const controls = [];
  const meta = { setAttribute: (_, value) => { meta.content = value; } };
  const document = {
    documentElement: { dataset: {}, style: {} },
    querySelector: () => meta,
    querySelectorAll: () => controls,
    addEventListener: (name, fn) => { events.document[name] = fn; },
  };
  const media = { matches: dark, addEventListener: (name, fn) => { events.media[name] = fn; } };
  const window = {
    matchMedia: () => media,
    addEventListener: (name, fn) => { events.window[name] = fn; },
    get localStorage() { if (blocked) throw new Error("Storage denied"); return storage; },
  };
  class Select {
    value = "system";
    matches() { return true; }
  }
  runInNewContext(script, { window, document, HTMLSelectElement: Select });
  return { api: window.WordTapTheme, root: document.documentElement, meta, values, controls,
    addControl: () => { const select = new Select(); controls.push(select); return select; },
    system: (value) => { media.matches = value; events.media.change(); },
    ready: () => events.document.DOMContentLoaded(),
    change: (target) => events.document.change({ target }),
    storage: (value, key = "wordtap-theme", area = storage) => {
      if (value === null) values.delete("wordtap-theme"); else values.set("wordtap-theme", value);
      events.window.storage({ key, storageArea: area });
    },
  };
}

test("first visit follows the system before controls mount and updates browser chrome", () => {
  const b = browser({ dark: true });
  assert.equal(b.api.getPreference(), "system");
  assert.equal(b.root.dataset.theme, "dark");
  assert.equal(b.root.style.colorScheme, "dark");
  assert.equal(b.meta.content, "#17171a");
  b.system(false);
  assert.equal(b.root.dataset.theme, "light");
  assert.equal(b.meta.content, "#f7f8fa");
  assert.equal(b.values.size, 0);
});

test("manual choice survives reload, overrides the system, and can return to automatic", () => {
  const b = browser({ dark: true });
  b.api.setPreference("light");
  b.system(false);
  b.system(true);
  assert.equal(b.root.dataset.theme, "light");
  assert.equal(b.values.get("wordtap-theme"), "light");
  assert.equal(browser({ stored: b.values.get("wordtap-theme"), dark: true }).root.dataset.theme, "light");
  b.api.setPreference("system");
  assert.equal(b.root.dataset.theme, "dark");
});

test("static selects and Vue subscribers stay synchronized without replacing page content", () => {
  const b = browser({ stored: "dark" });
  const first = b.addControl();
  const second = b.addControl();
  b.ready();
  assert.equal(first.value, "dark");
  const seen = [];
  const off = b.api.subscribe((...args) => seen.push(args));
  first.value = "light";
  b.change(first);
  assert.equal(second.value, "light");
  assert.deepEqual(seen, [["light", "light"]]);
  off();
  b.api.setPreference("dark");
  assert.equal(seen.length, 1);
  b.change({ value: "light" });
  assert.equal(b.root.dataset.theme, "dark");
});

test("same-origin tabs synchronize changes, removals and clear, ignoring session storage", () => {
  const b = browser({ stored: "light", dark: true });
  b.storage("dark");
  assert.equal(b.api.getPreference(), "dark");
  b.storage("light", "wordtap-theme", {});
  assert.equal(b.api.getPreference(), "dark");
  b.storage(null);
  assert.equal(b.api.getPreference(), "system");
  assert.equal(b.root.dataset.theme, "dark");
  b.api.setPreference("light");
  b.storage(null, null);
  assert.equal(b.root.dataset.theme, "dark");
});

test("corrupt or unavailable storage does not prevent switching", () => {
  const invalid = browser({ stored: "invalid", dark: true });
  assert.equal(invalid.api.getPreference(), "system");
  assert.equal(invalid.root.dataset.theme, "dark");
  const denied = browser({ blocked: true });
  denied.api.setPreference("dark");
  assert.equal(denied.root.dataset.theme, "dark");
  denied.system(false);
  assert.equal(denied.root.dataset.theme, "dark");
  assert.doesNotThrow(() => denied.storage("light"));
});

const css = readFileSync(new URL("../src/design-tokens.css", import.meta.url), "utf8");
function tokens(block) { return Object.fromEntries([...block.matchAll(/(--wt-[\w-]+):\s*(#[\da-f]{6})/gi)].map((m) => [m[1], m[2]])); }
function luminance(color) {
  const rgb = color.slice(1).match(/../g).map((c) => parseInt(c, 16) / 255)
    .map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
test("both palettes meet text contrast, including selected, semantic and primary button states", () => {
  const light = tokens(css.match(/:root\s*\{([^}]+)/)[1]);
  const dark = tokens(css.match(/:root\[data-theme="dark"\]\s*\{([^}]+)/)[1]);
  const fallback = tokens(css.match(/:root:not\(\[data-theme\]\)\s*\{([^}]+)/)[1]);
  assert.deepEqual(fallback, dark, "no-script palette must stay aligned");
  for (const [theme, palette] of [["light", light], ["dark", { ...light, ...dark }]]) {
    const pairs = [
      ...["text", "secondary", "primary", "primary-hover"].flatMap((text) =>
        ["background", "surface", "surface-secondary"].map((bg) => [text, bg])),
      ["secondary", "fill"], ["secondary", "primary-soft"], ["primary", "primary-soft"],
      ["primary-text", "primary-soft"], ["selected-text", "selected"],
      ...["success", "warning", "danger"].map((role) => [role, `${role}-soft`]),
      ...["primary-fill", "primary-fill-hover", "primary-fill-active"].map((bg) => ["on-primary", bg]),
    ];
    for (const [text, bg] of pairs) {
      const a = luminance(palette[`--wt-${text}`]), b = luminance(palette[`--wt-${bg}`]);
      const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      assert.ok(ratio >= 4.5, `${theme} ${text}/${bg}: ${ratio.toFixed(2)}`);
    }
  }
});
