import { nextTick, ref, watch, type Ref } from "vue";

interface CourseMenuProgress {
  groupId: string;
  lessonId: string;
  scrollByGroup: Record<string, number>;
}

function readProgress(key: string): CourseMenuProgress {
  const empty = { groupId: "", lessonId: "", scrollByGroup: {} };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return empty;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return empty;
    const saved = value as Partial<CourseMenuProgress>;
    const scrollByGroup: Record<string, number> = {};
    if (saved.scrollByGroup && typeof saved.scrollByGroup === "object") {
      for (const [id, position] of Object.entries(saved.scrollByGroup)) {
        if (Number.isFinite(position) && position >= 0) scrollByGroup[id] = position;
      }
    }
    return {
      groupId: typeof saved.groupId === "string" ? saved.groupId : "",
      lessonId: typeof saved.lessonId === "string" ? saved.lessonId : "",
      scrollByGroup,
    };
  } catch {
    return empty;
  }
}

export function useCourseMenuProgress(course: string, open: Ref<boolean>, searchQuery: Ref<string>) {
  const key = `wordtap.course-menu.${course}`;
  const saved = readProgress(key);
  const activeGroupId = ref(saved.groupId);
  const selectedLessonId = ref(saved.lessonId);
  const listElement = ref<HTMLElement | null>(null);
  const scrollByGroup = saved.scrollByGroup;
  let restoring = false;

  function persist(): void {
    try {
      window.localStorage.setItem(key, JSON.stringify({
        groupId: activeGroupId.value,
        lessonId: selectedLessonId.value,
        scrollByGroup,
      }));
    } catch {
      // The menu still works when browser storage is unavailable.
    }
  }

  function rememberScroll(): void {
    const list = listElement.value;
    if (!list || restoring || searchQuery.value.trim() || !activeGroupId.value) return;
    scrollByGroup[activeGroupId.value] = list.scrollTop;
    persist();
  }

  async function restoreScroll(): Promise<void> {
    await nextTick();
    const list = listElement.value;
    if (!open.value || !list || searchQuery.value.trim() || !list.querySelector("[data-lesson-id]")) return;
    restoring = true;
    const position = scrollByGroup[activeGroupId.value];
    if (position !== undefined) {
      list.scrollTop = position;
    } else if (selectedLessonId.value) {
      const selected = Array.from(list.querySelectorAll<HTMLElement>("[data-lesson-id]"))
        .find((item) => item.dataset.lessonId === selectedLessonId.value);
      if (selected) {
        const listRect = list.getBoundingClientRect();
        const itemRect = selected.getBoundingClientRect();
        list.scrollTop += itemRect.top - listRect.top - Math.max(0, (list.clientHeight - itemRect.height) / 2);
      }
    }
    requestAnimationFrame(() => { restoring = false; });
  }

  function setGroup(id: string): void {
    rememberScroll();
    activeGroupId.value = id;
    persist();
    void restoreScroll();
  }

  function syncGroups(ids: string[]): void {
    if (!ids.length) return;
    if (!ids.includes(activeGroupId.value)) {
      activeGroupId.value = ids[0];
      persist();
    }
    void restoreScroll();
  }

  function rememberLesson(groupId: string, lessonId: string): void {
    if (searchQuery.value.trim() || groupId !== activeGroupId.value) {
      delete scrollByGroup[groupId];
    } else {
      rememberScroll();
    }
    activeGroupId.value = groupId;
    selectedLessonId.value = lessonId;
    persist();
  }

  watch(open, (isOpen) => {
    if (isOpen) void restoreScroll();
  });

  return { activeGroupId, selectedLessonId, listElement, rememberScroll, restoreScroll, setGroup, syncGroups, rememberLesson };
}
