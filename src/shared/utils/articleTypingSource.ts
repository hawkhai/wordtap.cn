import type { ActiveCourseLesson } from "../types/app";
import { loadPepEnglishLesson } from "../data/pepEnglishLessons";
import { loadCollegeEnglishLesson } from "../data/collegeEnglishLessons";
import { loadPostgraduateLesson } from "../data/postgraduateLessons";
import { loadNceLesson } from "../data/nceLessons";
import { loadShuimuLesson } from "../data/shuimuLessons";
import { loadEnglishVocabularyLesson } from "../data/englishVocabularyLessons";
import { englishBlocks, nceBodyText, shuimuBodyText } from "./articleTyping";

/** null means this lesson has no reliable body boundary; the caller uses its visible text. */
export async function loadArticleTypingBody(lesson: ActiveCourseLesson): Promise<string | null> {
  switch (lesson.course) {
    case "english-vocabulary":
      return (await loadEnglishVocabularyLesson(lesson.path)).typingText;
    case "pep-english":
      return englishBlocks((await loadPepEnglishLesson(lesson.path)).blocks);
    case "college-english":
      return englishBlocks((await loadCollegeEnglishLesson(lesson.path)).blocks);
    case "postgraduate":
      return englishBlocks((await loadPostgraduateLesson(lesson.path)).blocks);
    case "nce":
      return nceBodyText(await loadNceLesson(lesson.path));
    case "shuimu":
      return shuimuBodyText((await loadShuimuLesson(lesson.path)).blocks) || null;
    default:
      return null;
  }
}
