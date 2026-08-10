import { calculateTypingDelay } from './delay.util';

describe('calculateTypingDelay', () => {
  it('should return 0 for empty string', () => {
    expect(calculateTypingDelay('')).toBe(0);
  });

  it('should scale linearly and add jitter', () => {
    const text = 'hello';
    const baseDelay = text.length * 15;
    const minExpected = baseDelay + 2000;
    const maxExpected = baseDelay + 5000;

    const delay = calculateTypingDelay(text);

    expect(delay).toBeGreaterThanOrEqual(minExpected);
    expect(delay).toBeLessThanOrEqual(maxExpected);
  });

  it('should return different values across multiple calls due to jitter', () => {
    const text = 'A long string to ensure jitter variance is noticeable';
    const results = new Set();

    for (let i = 0; i < 50; i++) {
      results.add(calculateTypingDelay(text));
    }

    // Almost statistically impossible to be 1 if jitter works
    expect(results.size).toBeGreaterThan(1);
  });
});
