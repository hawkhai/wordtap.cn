import lessonShortCodeConfig from "../data/lessonShortCodes.json" with { type: "json" };

const lessonIdPattern = /^([a-z0-9-]+)-(\d+)([a-z]?)$/;
const compactLessonIdPattern = /^([a-z0-9]+)-(\d+)([a-z]?)$/;
const collegeLessonIdPattern = /^([a-z0-9-]+)-u(\d+)-([abc])$/;
const compactCollegeLessonIdPattern = /^([a-z0-9]+)-u(\d+)-([abc])$/;
const prefixPattern = new RegExp(
  `^(${Object.values(lessonShortCodeConfig).map(({ prefix }) => escapeRegex(prefix)).join("|")}):(.+)$`,
);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function courseProtocol(course) {
  const protocol = lessonShortCodeConfig[course];
  if (!protocol) throw new Error(`Unknown course: ${course}`);
  return protocol;
}

// This is deliberately deterministic rather than an alias table. A reader can
// infer the source group from the token, and adding a group cannot silently
// change an existing code.
function semanticGroupToken(course, group) {
  const { prefix } = courseProtocol(course);
  if (course === "cet" && /^cet[46]$/.test(group)) {
    return `c${group.at(-1)}`;
  }
  if (group.startsWith(prefix) && group.length > prefix.length) {
    return group.slice(prefix.length);
  }

  const words = group.split("-");
  if (words.length > 1) return words.map((word) => word[0]).join("");

  const numberedGroup = /^([a-z]+)(\d+)$/.exec(group);
  if (numberedGroup) return `${numberedGroup[1][0]}${numberedGroup[2]}`;
  return group.slice(0, 3);
}

function assertProtocolConfiguration() {
  const entries = Object.entries(lessonShortCodeConfig);
  const prefixes = entries.map(([, protocol]) => protocol.prefix);
  if (new Set(prefixes).size !== prefixes.length) {
    throw new Error("Lesson short-code course prefixes must be unique");
  }

  for (const [course, protocol] of entries) {
    if (!/^[a-z]{1,3}$/.test(protocol.prefix)) {
      throw new Error(`Invalid lesson short-code prefix: ${course}/${protocol.prefix}`);
    }
    if (!Number.isInteger(protocol.padding) || protocol.padding < 1) {
      throw new Error(`Invalid lesson-number padding: ${course}/${protocol.padding}`);
    }
    if (!Array.isArray(protocol.groups) || protocol.groups.length === 0) {
      throw new Error(`Lesson short-code groups are missing: ${course}`);
    }
    if (!protocol.groups.every((group) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(group))) {
      throw new Error(`Invalid lesson group: ${course}`);
    }
    const tokens = protocol.groups.map((group) => semanticGroupToken(course, group));
    if (!tokens.every((token) => /^[a-z0-9]+$/.test(token))) {
      throw new Error(`Invalid derived lesson group token: ${course}`);
    }
    if (new Set(tokens).size !== tokens.length) {
      throw new Error(`Lesson short-code group collision: ${course}`);
    }
  }
}

assertProtocolConfiguration();

export function compactLessonId(course, lessonId) {
  const normalizedId = String(lessonId ?? "").trim().toLowerCase();
  if (course === "college-english") {
    const match = collegeLessonIdPattern.exec(normalizedId);
    if (!match) throw new Error(`Invalid lesson id: ${lessonId}`);
    const protocol = courseProtocol(course);
    if (!protocol.groups.includes(match[1])) throw new Error(`Unknown lesson group: ${course}/${match[1]}`);
    if (match[2].length !== protocol.padding) {
      throw new Error(`Invalid lesson number width: ${course}/${lessonId}`);
    }
    return `${semanticGroupToken(course, match[1])}-u${match[2]}-${match[3]}`;
  }
  const match = lessonIdPattern.exec(normalizedId);
  if (!match) throw new Error(`Invalid lesson id: ${lessonId}`);

  const protocol = courseProtocol(course);
  if (!protocol.groups.includes(match[1])) throw new Error(`Unknown lesson group: ${course}/${match[1]}`);
  if (match[2].length !== protocol.padding) {
    throw new Error(`Invalid lesson number width: ${course}/${lessonId}`);
  }
  return `${semanticGroupToken(course, match[1])}-${match[2]}${match[3]}`;
}

function expandLessonId(course, compactId) {
  const normalizedId = String(compactId ?? "").trim().toLowerCase();
  if (course === "college-english") {
    const match = compactCollegeLessonIdPattern.exec(normalizedId);
    if (!match) return null;
    const protocol = courseProtocol(course);
    if (match[2].length !== protocol.padding) return null;
    const group = protocol.groups.find((candidate) => semanticGroupToken(course, candidate) === match[1]);
    return group ? `${group}-u${match[2]}-${match[3]}` : null;
  }
  const match = compactLessonIdPattern.exec(normalizedId);
  if (!match) return null;

  const protocol = courseProtocol(course);
  if (match[2].length !== protocol.padding) return null;
  const group = protocol.groups.find((candidate) => semanticGroupToken(course, candidate) === match[1]);
  if (!group) return null;
  return `${group}-${match[2]}${match[3]}`;
}

export function lessonShortCode(course, lessonId) {
  return `${courseProtocol(course).prefix}:${compactLessonId(course, lessonId)}`;
}

export function parseLessonShortCode(rawCode) {
  const match = prefixPattern.exec(String(rawCode ?? "").trim().toLowerCase());
  if (!match) return null;

  const course = Object.entries(lessonShortCodeConfig).find(([, protocol]) => protocol.prefix === match[1])?.[0];
  if (!course) return null;
  const id = expandLessonId(course, match[2]);
  return id ? { course, id } : null;
}

export function buildLessonShortUrl(baseUrl, course, lessonId) {
  const url = new URL(baseUrl);
  url.search = `?l=${lessonShortCode(course, lessonId)}`;
  url.hash = "study";
  return url.toString();
}

export { lessonShortCodeConfig };
