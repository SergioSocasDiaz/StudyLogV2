import { describe, expect, it } from 'vitest';

import {
  apiErrorSchema,
  parseValidationErrorDetails,
  validationErrorDetailsSchema,
} from '../index';

describe('validationErrorDetailsSchema', () => {
  it('acepta un resultado tipo flatten() con dos campos con errores', () => {
    const details = {
      formErrors: [],
      fieldErrors: {
        email: ['El email no es válido'],
        password: ['La contraseña es demasiado corta'],
      },
    };

    const result = validationErrorDetailsSchema.safeParse(details);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(details);
  });

  it('acepta un campo que acumula varios mensajes', () => {
    const details = {
      formErrors: [],
      fieldErrors: {
        password: [
          'La contraseña es demasiado corta',
          'La contraseña debe incluir un número',
        ],
      },
    };

    const result = validationErrorDetailsSchema.safeParse(details);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(details);
  });

  it('acepta errores de formulario sin errores de campo', () => {
    const details = {
      formErrors: ['Las contraseñas no coinciden'],
      fieldErrors: {},
    };

    const result = validationErrorDetailsSchema.safeParse(details);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(details);
  });

  it('rechaza un valor de fieldErrors que no es un array de strings', () => {
    const result = validationErrorDetailsSchema.safeParse({
      formErrors: [],
      fieldErrors: { password: 'mala' },
    });

    expect(result.success).toBe(false);
  });

  it('rechaza un array de fieldErrors que contiene elementos no string', () => {
    const result = validationErrorDetailsSchema.safeParse({
      formErrors: [],
      fieldErrors: { password: [1] },
    });

    expect(result.success).toBe(false);
  });

  it('rechaza formErrors que no es un array de strings', () => {
    const withString = validationErrorDetailsSchema.safeParse({
      formErrors: 'algo',
      fieldErrors: {},
    });

    const withNumbers = validationErrorDetailsSchema.safeParse({
      formErrors: [1, 2],
      fieldErrors: {},
    });

    expect(withString.success).toBe(false);
    expect(withNumbers.success).toBe(false);
  });

  it('rechaza una entrada completa que no es un objeto', () => {
    const inputs: unknown[] = [null, undefined, 'no soy un objeto', []];

    for (const input of inputs) {
      const result = validationErrorDetailsSchema.safeParse(input);
      expect(result.success).toBe(false);
    }
  });
});

describe('parseValidationErrorDetails', () => {
  it('devuelve null cuando details no está presente', () => {
    expect(parseValidationErrorDetails(undefined)).toBeNull();
  });

  it('devuelve null cuando details pertenece a otro tipo de error', () => {
    expect(parseValidationErrorDetails({ retryAfterSeconds: 30 })).toBeNull();
  });

  it('devuelve null cuando details no tiene la forma esperada', () => {
    expect(parseValidationErrorDetails('basura')).toBeNull();
    expect(parseValidationErrorDetails(42)).toBeNull();
    expect(parseValidationErrorDetails(null)).toBeNull();
    expect(parseValidationErrorDetails({ formErrors: [], fieldErrors: { a: 1 } })).toBeNull();
  });

  it('devuelve el objeto validado cuando details describe errores de validación', () => {
    const details = {
      formErrors: ['Hay campos pendientes'],
      fieldErrors: {
        email: ['El email no es válido'],
      },
    };

    expect(parseValidationErrorDetails(details)).toEqual(details);
  });
});

describe('apiErrorSchema', () => {
  it('acepta el envelope mínimo con código y mensaje', () => {
    const payload = {
      error: {
        code: 'NOT_FOUND',
        message: 'El recurso no existe',
      },
    };

    const result = apiErrorSchema.safeParse(payload);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(payload);
  });

  it('acepta el envelope completo con details', () => {
    const payload = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Los datos no son válidos',
        details: {
          formErrors: [],
          fieldErrors: { email: ['El email no es válido'] },
        },
      },
    };

    const result = apiErrorSchema.safeParse(payload);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(payload);
  });

  it('rechaza un código de error no reconocido', () => {
    const result = apiErrorSchema.safeParse({
      error: {
        code: 'TEAPOT',
        message: 'No existo en el contrato',
      },
    });

    expect(result.success).toBe(false);
  });

  it('rechaza un mensaje vacío', () => {
    const result = apiErrorSchema.safeParse({
      error: {
        code: 'INTERNAL_ERROR',
        message: '',
      },
    });

    expect(result.success).toBe(false);
  });
});
