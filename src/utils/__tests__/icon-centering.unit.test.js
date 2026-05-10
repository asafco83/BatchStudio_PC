import { describe, it, expect } from 'vitest';
import { computeCenterPosition } from '../icon-calculations.js';

describe('computeCenterPosition - unit tests', () => {
  it('should center with default 15% width → x: 42.5, y: 42.5', () => {
    const { x, y } = computeCenterPosition(15);
    expect(x).toBe(42.5);
    expect(y).toBe(42.5);
  });

  it('should center with 50% width → x: 25, y: 25', () => {
    const { x, y } = computeCenterPosition(50);
    expect(x).toBe(25);
    expect(y).toBe(25);
  });

  it('should center with 1% width → x: 49.5, y: 49.5', () => {
    const { x, y } = computeCenterPosition(1);
    expect(x).toBe(49.5);
    expect(y).toBe(49.5);
  });
});
