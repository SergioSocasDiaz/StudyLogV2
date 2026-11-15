import { z } from 'zod';

export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (timezone) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Invalid IANA timezone' },
  );

export const emailSchema = z.string().trim().toLowerCase().email();
export const displayNameSchema = z.string().trim().min(1).max(80);
export const passwordSchema = z.string().min(12).max(128);

export const registerInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  timezone: timezoneSchema.default('UTC'),
});

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: emailSchema,
  displayName: displayNameSchema,
  timezone: timezoneSchema,
  createdAt: z.string().datetime(),
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
