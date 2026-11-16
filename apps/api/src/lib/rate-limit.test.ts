import { describe, expect, it } from 'vitest';

import { createMemoryRateLimitStore } from './rate-limit.js';

describe('in-memory rate limit store', () => {
  it('counts hits inside the window and resets after it', async () => {
    let now = 1_000;
    const store = createMemoryRateLimitStore(() => now);

    const first = await store.hit('key', 60_000);
    const second = await store.hit('key', 60_000);

    expect(first.count).toBe(1);
    expect(second.count).toBe(2);
    expect(second.resetAt).toBe(first.resetAt);

    now += 60_001;
    const afterReset = await store.hit('key', 60_000);

    expect(afterReset.count).toBe(1);
    expect(afterReset.resetAt).toBeGreaterThan(now);
  });

  it('keeps buckets independent', async () => {
    const store = createMemoryRateLimitStore(() => 1_000);

    await store.hit('ip:1.2.3.4', 60_000);
    await store.hit('ip:1.2.3.4', 60_000);

    const otherBucket = await store.hit('email:abc', 60_000);
    expect(otherBucket.count).toBe(1);
  });
});
