import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";
import "./desktop/styles/desktop.css";
import "./mobile/styles/mobile.css";

createApp(App).mount("#app");

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  } else {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {});

    if ("caches" in window) {
      caches.keys()
        .then((keys) => Promise.all(keys.filter((key) => key.startsWith("wordtap-")).map((key) => caches.delete(key))))
        .catch(() => {});
    }
  }
}
