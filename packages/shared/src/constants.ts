export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_SESSION_HOURS = 12;
export const MAX_SESSION_SECONDS = MAX_SESSION_HOURS * 60 * 60;

export const SUBJECT_COLORS = [
  '#2563EB',
  '#0891B2',
  '#0D9488',
  '#16A34A',
  '#65A30D',
  '#CA8A04',
  '#EA580C',
  '#DC2626',
  '#DB2777',
  '#475569',
] as const;

export type SubjectColor = (typeof SUBJECT_COLORS)[number];
