import { z } from 'zod';

/**
 * Form-level schemas.
 *
 * The constraints mirror `packages/shared` (same email normalisation, same
 * 12–128 password range) but the messages are in Spanish, because Zod's default
 * wording is shown to the user. The API validates again with the shared schema:
 * the client copy is UX, not security.
 */
const emailField = z.string().trim().toLowerCase().email({ message: 'Email no válido' });

export const loginFormSchema = z.object({
  email: z.string().trim().min(1, { message: 'Escribe tu email' }).pipe(emailField),
  password: z.string().min(1, { message: 'Escribe tu contraseña' }),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const registerFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, { message: 'Escribe tu nombre' })
    .max(80, { message: 'Máximo 80 caracteres' }),
  email: z.string().trim().min(1, { message: 'Escribe tu email' }).pipe(emailField),
  password: z
    .string()
    .min(12, { message: 'La contraseña debe tener al menos 12 caracteres' })
    .max(128, { message: 'Máximo 128 caracteres' }),
  timezone: z.string().trim().min(1, { message: 'Elige tu zona horaria' }),
});

export type RegisterFormValues = z.infer<typeof registerFormSchema>;
