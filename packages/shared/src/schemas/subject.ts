import { z } from 'zod';

export const colorHexSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must use the #RRGGBB format' });

export const subjectFieldsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  colorHex: colorHexSchema,
  targetHoursWeek: z.number().min(0).max(168).nullable().optional(),
});

export const subjectInputSchema = subjectFieldsSchema;

export const subjectSchema = subjectFieldsSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SubjectInput = z.infer<typeof subjectInputSchema>;
export type Subject = z.infer<typeof subjectSchema>;
