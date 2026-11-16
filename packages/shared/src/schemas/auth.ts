import { z } from 'zod';

import { publicUserSchema } from './user.js';

/**
 * Response of `POST /api/v1/auth/register` and `POST /api/v1/auth/login`.
 *
 * The access token travels in the body because the client keeps it in memory.
 * The refresh token never appears here: it is sent as an httpOnly cookie.
 */
export const authResponseSchema = z.object({
  user: publicUserSchema,
  accessToken: z.string().min(1),
});

/**
 * Response of `POST /api/v1/auth/refresh`.
 *
 * Only a new access token is returned; the rotated refresh token travels in the
 * `Set-Cookie` header.
 */
export const refreshResponseSchema = z.object({
  accessToken: z.string().min(1),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
