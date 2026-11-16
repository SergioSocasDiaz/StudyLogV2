import { parseValidationErrorDetails } from '@studylog/shared';

import { ApiRequestError } from '../../lib/api';

export interface FormErrorMapping {
  /** Message for the form-level alert, or `null` when every error has a field. */
  root: string | null;
  /** Field name → first message from the server. */
  fields: Record<string, string>;
}

const GENERIC_MESSAGE = 'No hemos podido completar la operación. Inténtalo de nuevo.';

/**
 * Turns an API error into something a form can show.
 *
 * `VALIDATION_ERROR` (422) carries `fieldErrors`, so each message lands under
 * its field; everything else becomes a form-level alert. Kept free of React so
 * it can be unit tested without a component.
 */
export function mapApiError(error: unknown): FormErrorMapping {
  if (!(error instanceof ApiRequestError)) {
    return { root: GENERIC_MESSAGE, fields: {} };
  }

  if (error.status === 422) {
    const details = parseValidationErrorDetails(error.details);

    if (!details) {
      return { root: 'Revisa los datos del formulario.', fields: {} };
    }

    const fields: Record<string, string> = {};
    for (const [field, messages] of Object.entries(details.fieldErrors)) {
      const first = messages[0];
      if (first) {
        fields[field] = first;
      }
    }

    const root = details.formErrors[0] ?? null;
    return {
      root: root ?? (Object.keys(fields).length > 0 ? null : 'Revisa los datos del formulario.'),
      fields,
    };
  }

  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return { root: 'Email o contraseña incorrectos.', fields: {} };
    case 'CONFLICT':
      return {
        root: 'No hemos podido crear la cuenta con esos datos. Prueba con otro email o inicia sesión.',
        fields: {},
      };
    case 'RATE_LIMITED': {
      const seconds = Math.max(1, Math.ceil(error.retryAfterSeconds ?? 60));
      return {
        root: `Demasiados intentos. Inténtalo de nuevo en ${seconds} segundos.`,
        fields: {},
      };
    }
    case 'FORBIDDEN':
      return {
        root: 'La petición no llegó desde un origen permitido. Recarga la página e inténtalo de nuevo.',
        fields: {},
      };
    case 'NETWORK_ERROR':
      return {
        root: 'No pudimos conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
        fields: {},
      };
    default:
      return { root: GENERIC_MESSAGE, fields: {} };
  }
}
