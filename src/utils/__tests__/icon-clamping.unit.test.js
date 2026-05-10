import { describe, it, expect } from 'vitest';
import { clampIconWidth } from '../icon-calculations.js';

describe('clampIconWidth - unit tests', () => {
  it('should calculate min 5% for minWidth 50px on 1000px canvas', () => {
    const result = clampIconWidth(3, 50, 1000);
    expect(result).toBe(5); // 50/1000*100 = 5%, requested 3% < 5% → clamped to 5%
  });

  it('should use 2% minimum when minWidth is null', () => {
    const result = clampIconWidth(1, null, 1000);
    expect(result).toBe(2); // null minWidth → 2% minimum, requested 1% < 2% → clamped to 2%
  });

  it('should clamp requested width below minimum', () => {
    const result = clampIconWidth(-5, 100, 1000);
    expect(result).toBe(10); // 100/1000*100 = 10%, requested -5% < 10% → clamped to 10%
  });

  it('should not clamp requested width above minimum', () => {
    const result = clampIconWidth(20, 50, 1000);
    expect(result).toBe(20); // 50/1000*100 = 5%, requested 20% > 5% → unchanged
  });
});
