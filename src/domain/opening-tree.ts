/**
 * An opening course as a tree. The lines of a course share their first moves; where they part,
 * the position has several continuations. The tree is read straight from the lines: the
 * continuations of a position are the next moves of the lines that pass through it.
 */

export interface OpeningMove {
  san: string;
  why: string;
}

export interface OpeningLine {
  id: string;
  name: string;
  moves: OpeningMove[];
}

export interface OpeningCourse {
  lines: OpeningLine[];
}

export interface Continuation {
  san: string;
  lines: OpeningLine[];
}

/** The lines that start with the given moves. */
export function linesThrough(course: OpeningCourse, sans: readonly string[]): OpeningLine[] {
  return course.lines.filter(line =>
    line.moves.length > sans.length && sans.every((san, index) => line.moves[index].san === san));
}

/** The different moves played in the position after `sans`, each with the lines that continue with it. */
export function continuations(course: OpeningCourse, sans: readonly string[]): Continuation[] {
  const bySan = new Map<string, OpeningLine[]>();
  for (const line of linesThrough(course, sans)) {
    const san = line.moves[sans.length].san;
    bySan.set(san, [...(bySan.get(san) || []), line]);
  }
  return [...bySan].map(([san, lines]) => ({ san, lines }));
}

/**
 * Picks the line to follow after `sans`, preferring lines not yet done; `random` returns [0, 1).
 * Each line is equally likely, so a reply the course covers in depth comes up more often.
 */
export function pickLine(
  course: OpeningCourse,
  sans: readonly string[],
  isDone: (line: OpeningLine) => boolean = () => false,
  random: () => number = Math.random
): OpeningLine | null {
  const candidates = linesThrough(course, sans);
  if (candidates.length === 0) return null;
  const fresh = candidates.filter(line => !isDone(line));
  const pool = fresh.length ? fresh : candidates;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
