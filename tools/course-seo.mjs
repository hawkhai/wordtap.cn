// Keep source titles intact in the article; only shorten search/social titles.
export function lessonSeoTitle(course, lessonTitle, maxLength = 70) {
  const prefix = `${course.trim()} `;
  const suffix = " - WordTap";
  const subject = String(lessonTitle ?? "").replace(/\s+/gu, " ").trim();
  const available = maxLength - Array.from(prefix + suffix).length;
  if (available < 8) throw new Error(`Course label leaves too little room for its title: ${course}`);
  if (Array.from(subject).length <= available) return `${prefix}${subject}${suffix}`;
  let shortened = Array.from(subject).slice(0, available - 1).join("");
  // Avoid cutting an English word; Chinese text can be shortened by character.
  if (/[A-Za-z]$/.test(shortened) && /^[A-Za-z]/.test(Array.from(subject).slice(available - 1).join(""))) {
    const boundary = shortened.lastIndexOf(" ");
    if (boundary > shortened.length / 2) shortened = shortened.slice(0, boundary);
  }
  return `${prefix}${shortened.trimEnd()}…${suffix}`;
}
