import { hash, verify } from '@node-rs/argon2';

/**
 * argon2id parameters.
 *
 * 19 MiB / timeCost 2 / parallelism 1 is the OWASP baseline: ~10-15 ms per hash
 * on the machines this project targets, which is fast enough for a serverless
 * function and slow enough to make offline guessing expensive.
 *
 * The library is native (napi-rs), so it is kept external in the bundle. It
 * ships prebuilt binaries for the platforms Vercel and CI use. `algorithm` is
 * omitted on purpose: argon2id is its default, and the enum cannot be imported
 * under `verbatimModuleSyntax`.
 */
const HASH_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * A real hash of a throwaway password.
 *
 * When an email does not exist, `verifyPassword` still runs against this hash.
 * Without it, "user not found" would return in ~1 ms and "wrong password" in
 * ~12 ms, which lets an attacker enumerate accounts by timing alone.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$L1lNBF9LRFy6ul4Jb1qgkw$NU+pXjmJ53QFbp0IXgE5FemLpIWy7bC1bs1qXblWwrM';

export async function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, HASH_OPTIONS);
}

export async function verifyPassword(hashValue: string, plainPassword: string): Promise<boolean> {
  try {
    return await verify(hashValue, plainPassword);
  } catch {
    // A corrupted hash must behave like a wrong password, never like a crash.
    return false;
  }
}

/** Constant-time-ish equivalent used when the account does not exist. */
export async function verifyPasswordAgainstDummy(plainPassword: string): Promise<void> {
  await verifyPassword(DUMMY_HASH, plainPassword);
}
