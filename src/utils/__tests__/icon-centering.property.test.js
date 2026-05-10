import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeCenterPosition } from '../icon-calculations.js';

/**
 * Feature: ui-polish-improvements, Property 3: Icon centering calculation
 *
 * Validates: Requirements 5.1, 5.2
 *
 * For any default icon width percentage (0 < width < 100), the computed center
 * position SHALL satisfy x = (100 - width) / 2 and y = (100 - width) / 2,
 * ensuring the icon is equidistant from both edges.
 */
describe('Feature: ui-polish-improvements, Property 3: Icon centering calculation', () => {
  it('should center the icon equidistant from both edges', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(99.99), noNaN: true }),
        (defaultWidth) => {
          const { x, y } = computeCenterPosition(defaultWidth);

          // x and y should equal (100 - defaultWidth) / 2
          expect(x).toBeCloseTo((100 - defaultWidth) / 2, 5);
          expect(y).toBeCloseTo((100 - defaultWidth) / 2, 5);

          // Both should be >= 0 and <= 100
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(100);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});
