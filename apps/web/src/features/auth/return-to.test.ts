import { describe, expect, it } from 'vitest';

import { safeReturnTo } from './return-to';

const ORIGIN = 'http://app.test';

describe('safeReturnTo', () => {
  it('acepta /app tal cual', () => {
    expect(safeReturnTo('/app', ORIGIN)).toBe('/app');
  });

  it('conserva la ruta, la query y el hash de una ruta interna', () => {
    expect(safeReturnTo('/app/subjects?tab=1#hoy', ORIGIN)).toBe('/app/subjects?tab=1#hoy');
  });

  it('devuelve /app cuando el valor es null', () => {
    expect(safeReturnTo(null, ORIGIN)).toBe('/app');
  });

  it('devuelve /app cuando el valor es undefined', () => {
    expect(safeReturnTo(undefined, ORIGIN)).toBe('/app');
  });

  it('devuelve /app cuando el valor es una cadena vacía', () => {
    expect(safeReturnTo('', ORIGIN)).toBe('/app');
  });

  it('rechaza una URL absoluta de otro origen', () => {
    expect(safeReturnTo('https://evil.example', ORIGIN)).toBe('/app');
  });

  it('rechaza una URL protocol-relative de otro origen', () => {
    expect(safeReturnTo('//evil.example', ORIGIN)).toBe('/app');
  });

  it('rechaza una ruta interna fuera de /app', () => {
    expect(safeReturnTo('/login', ORIGIN)).toBe('/app');
  });

  it('rechaza una ruta que escapa de /app al normalizarse', () => {
    expect(safeReturnTo('/app/../login', ORIGIN)).toBe('/app');
  });

  it('rechaza una ruta sin barra inicial', () => {
    expect(safeReturnTo('app', ORIGIN)).toBe('/app');
  });

  it('rechaza un prefijo parecido a /app que no es /app ni /app/...', () => {
    expect(safeReturnTo('/appx', ORIGIN)).toBe('/app');
  });
});
