import { z } from 'zod';

import { ERROR_CODES } from '../errors.js';

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
});

/**
 * Shape of `details` for `VALIDATION_ERROR` (422).
 *
 * The API serialises the Zod error with `error.flatten()`, which yields
 * `{ formErrors, fieldErrors }`. `fieldErrors` only contains the keys that
 * actually failed, so a partially valid payload comes back without the valid
 * fields.
 */
export const validationErrorDetailsSchema = z.object({
  formErrors: z.array(z.string()),
  fieldErrors: z.record(z.string(), z.array(z.string())),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
export type ValidationErrorDetails = z.infer<typeof validationErrorDetailsSchema>;

/**
 * Guards the untyped `details` field of an API error.
 *
 * Returns `null` when the error carries something else (a rate-limit reset
 * time, for example), so callers can fall back to a form-level message.
 */
export function parseValidationErrorDetails(details: unknown): ValidationErrorDetails | null {
  const parsed = validationErrorDetailsSchema.safeParse(details);
  return parsed.success ? parsed.data : null;
}
