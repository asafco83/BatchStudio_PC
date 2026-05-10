import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeIconDimensions } from '../icon-calculations.js';

/**
 * Feature: ui-polish-improvements, Property 1: Icon dimension calculation correctness
 *
 * Validates: Requirements 3.1, 3.2
 *
 * For any valid icon width percentage (0 < width ≤ 100), any template output width (> 0),
 * and any positive native aspect ratio (nativeWidth, nativeHeight > 0), the computed output
 * dimensions SHALL satisfy:
 * - outputWidth = round(widthPercent / 100 * templateWidth)
 * - outputHeight = round(outputWidth * nativeHeight / nativeWidth)
 * - Both values are non-negative integers
 */
describe('Feature: ui-polish-improvements, Property 1: Icon dimension calculation correctness', () => {
  it('should compute valid positive dimensions for any valid inputs', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: 100, noNaN: true }),
        fc.integer({ min: 1, max: 8000 }),
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 1, max: 5000 }),
        (widthPct, templateW, nativeW, nativeH) => {
          const { outputWidth, outputHeight } = computeIconDimensions(widthPct, templateW, nativeW, nativeH);

          // outputWidth should equal Math.round(widthPct / 100 * templateW)
          expect(outputWidth).toBe(Math.round(widthPct / 100 * templateW));

          // outputHeight should equal Math.round(outputWidth * nativeH / nativeW)
          expect(outputHeight).toBe(Math.round(outputWidth * nativeH / nativeW));

          // Both should be non-negative integers (0 is valid when widthPct is very small)
          expect(outputWidth).toBeGreaterThanOrEqual(0);
          expect(outputHeight).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return null outputHeight when native dimensions are not available', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: 100, noNaN: true }),
        fc.integer({ min: 1, max: 8000 }),
        (widthPct, templateW) => {
          const { outputWidth, outputHeight, label } = computeIconDimensions(widthPct, templateW, null, null);

          expect(outputHeight).toBeNull();
          expect(label).toBe(`${outputWidth} px wide`);
        }
      ),
      { numRuns: 100 }
    );
  });
});
