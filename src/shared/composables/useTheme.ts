import { onMounted, onUnmounted, ref } from "vue";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

declare global {
  interface Window {
    WordTapTheme?: {
      getPreference(): ThemePreference;
      setPreference(value: ThemePreference): void;
      subscribe(listener: (preference: ThemePreference, resolved: ResolvedTheme) => void): () => void;
    };
  }
}

export function useTheme() {
  const preference = ref<ThemePreference>(window.WordTapTheme?.getPreference() ?? "system");
  const available = !!window.WordTapTheme;
  let unsubscribe: (() => void) | undefined;
  onMounted(() => {
    preference.value = window.WordTapTheme?.getPreference() ?? "system";
    unsubscribe = window.WordTapTheme?.subscribe((value) => { preference.value = value; });
  });
  onUnmounted(() => unsubscribe?.());
  return { preference, available };
}
