/* Shared by the Vue workspace and generated course pages; run before paint. */
(function () {
  "use strict";
  var key = "wordtap-theme";
  var root = document.documentElement;
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  var listeners = new Set();
  function normalize(value) {
    return value === "light" || value === "dark" ? value : "system";
  }
  function readPreference() {
    try { return normalize(window.localStorage.getItem(key)); }
    catch (_) { return "system"; }
  }
  var preference = readPreference();
  function apply() {
    var resolved = preference === "system" ? (media.matches ? "dark" : "light") : preference;
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
    root.style.backgroundColor = resolved === "dark" ? "#17171a" : "#f7f8fa";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolved === "dark" ? "#17171a" : "#f7f8fa");
    document.querySelectorAll("select[data-wt-theme]").forEach(function (select) {
      select.value = preference;
    });
    listeners.forEach(function (listener) { listener(preference, resolved); });
  }
  window.WordTapTheme = {
    getPreference: function () { return preference; },
    setPreference: function (value) {
      preference = normalize(value);
      try { window.localStorage.setItem(key, preference); } catch (_) { /* Optional preference. */ }
      apply();
    },
    subscribe: function (listener) {
      listeners.add(listener);
      return function () { listeners.delete(listener); };
    }
  };
  apply();
  media.addEventListener("change", function () { if (preference === "system") apply(); });
  window.addEventListener("storage", function (event) {
    if (event.key !== key && event.key !== null) return;
    try { if (event.storageArea !== window.localStorage) return; }
    catch (_) { return; }
    preference = readPreference();
    apply();
  });
  document.addEventListener("change", function (event) {
    if (event.target instanceof HTMLSelectElement && event.target.matches("select[data-wt-theme]")) {
      window.WordTapTheme.setPreference(event.target.value);
    }
  });
  document.addEventListener("DOMContentLoaded", apply, { once: true });
})();
