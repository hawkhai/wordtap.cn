import type { CourseId } from "../types/app";

export type LessonShortCodeConfig = Record<CourseId, {
  prefix: string;
  padding: number;
  groups: string[];
}>;

export function compactLessonId(course: CourseId, lessonId: string): string;
export function lessonShortCode(course: CourseId, lessonId: string): string;
export function parseLessonShortCode(rawCode: string): { course: CourseId; id: string } | null;
export function buildLessonShortUrl(baseUrl: URL, course: CourseId, lessonId: string): string;
export const lessonShortCodeConfig: LessonShortCodeConfig;
