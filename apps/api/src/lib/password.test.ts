import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword, verifyPasswordAgainstDummy } from './password.js';

describe('password hashing', () => {
  it('produces an argon2id hash, not the plain password', async () => {
    const hash = await hashPassword('una-contraseña-segura');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('una-contraseña-segura');
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('una-contraseña-segura');

    await expect(verifyPassword(hash, 'una-contraseña-segura')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'otra-contraseña-segura')).resolves.toBe(false);
  });

  it('salts every hash so two equal passwords differ', async () => {
    const first = await hashPassword('una-contraseña-segura');
    const second = await hashPassword('una-contraseña-segura');

    expect(first).not.toBe(second);
  });

  it('treats a corrupted hash as a wrong password instead of throwing', async () => {
    await expect(verifyPassword('not-a-hash', 'una-contraseña-segura')).resolves.toBe(false);
  });

  it('runs the dummy verification without throwing', async () => {
    await expect(verifyPasswordAgainstDummy('cualquier-cosa-larga')).resolves.toBeUndefined();
  });
});
