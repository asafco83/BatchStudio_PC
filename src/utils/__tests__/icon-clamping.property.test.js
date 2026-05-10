import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { clampIconWidth } from '../icon-calculations.js';

/**
 * Feature: ui-polish-improvements, Property 2: Minimum width clamping invariant
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 *
 * For any canvas width (> 0), any configured minWidth in pixels (≥ 0 or null),
 * and any requested resize width percentage, the resulting icon width percentage
 * SHALL always be ≥ max(minWidth / canvasWidth * 100, 2) when minWidth is set,
 * or ≥ 2 when minWidth is null.
 */
describe('Feature: ui-polish-improvements, Property 2: Minimum width clamping invariant', () => {
  it('should clamp to configured minimum when minWidth is set', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -50, max: 150, noNaN: true }),
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 100, max: 4000 }),
        (requestedW, minWidthPx, canvasWidth) => {
          const result = clampIconWidth(requestedW, minWidthPx, canvasWidth);
          const expectedMin = (minWidthPx / canvasWidth) * 100;

          // Result should always be >= the calculated minimum
          expect(result).toBeGreaterThanOrEqual(expectedMin - 0.0001); // floating point tolerance

          // Result should always be >= requested if requested is above minimum
          if (requestedW >= expectedMin) {
            expect(result).toBeCloseTo(requestedW, 4);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should clamp to 2% minimum when minWidth is null', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -50, max: 150, noNaN: true }),
        fc.integer({ min: 100, max: 4000 }),
        (requestedW, canvasWidth) => {
          const result = clampIconWidth(requestedW, null, canvasWidth);

          // Result should always be >= 2%
          expect(result).toBeGreaterThanOrEqual(2);

          // Result should equal requested if requested is above 2%
          if (requestedW >= 2) {
            expect(result).toBeCloseTo(requestedW, 4);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
