import { describe, it, expect } from 'vitest';
import { getSafeAreaColor } from '../icon-calculations.js';

describe('getSafeAreaColor - unit tests', () => {
  it('should use configured value when safeAreaColor is present', () => {
    const config = { safeAreaColor: '#00ff0088' };
    expect(getSafeAreaColor(config)).toBe('#00ff0088');
  });

  it('should fall back to #ef4444ff when safeAreaColor is absent', () => {
    const config = {};
    expect(getSafeAreaColor(config)).toBe('#ef4444ff');
  });

  it('should fall back to #ef4444ff when config is null', () => {
    expect(getSafeAreaColor(null)).toBe('#ef4444ff');
  });

  it('should fall back to #ef4444ff when safeAreaColor is empty string', () => {
    const config = { safeAreaColor: '' };
    expect(getSafeAreaColor(config)).toBe('#ef4444ff');
  });
});
