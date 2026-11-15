import { z } from 'zod';

export const sessionSourceSchema = z.enum(['manual', 'pomodoro']);

export const idempotencyKeySchema = z.string().trim().min(1).max(128);

const studySessionFieldsSchema = z.object({
  subjectId: z.string().uuid(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  source: sessionSourceSchema.default('manual'),
  note: z.string().trim().max(1000).nullable().optional(),
});

export const studySessionInputSchema = studySessionFieldsSchema.refine(
  (session) => new Date(session.endedAt).getTime() > new Date(session.startedAt).getTime(),
  { message: 'endedAt must be after startedAt', path: ['endedAt'] },
);

export const studySessionSchema = studySessionFieldsSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  durationSeconds: z.number().int().positive(),
  idempotencyKey: idempotencyKeySchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SessionSource = z.infer<typeof sessionSourceSchema>;
export type StudySessionInput = z.infer<typeof studySessionInputSchema>;
export type StudySession = z.infer<typeof studySessionSchema>;
