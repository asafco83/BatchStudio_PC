import { describe, it, expect } from 'vitest';
import { computeIconDimensions } from '../icon-calculations.js';

describe('computeIconDimensions - unit tests', () => {
  it('should compute correct dimensions for 1080px template, 15% width, 1:1 ratio', () => {
    const { outputWidth, outputHeight, label } = computeIconDimensions(15, 1080, 100, 100);
    expect(outputWidth).toBe(162);
    expect(outputHeight).toBe(162);
    expect(label).toBe('162 × 162 px');
  });

  it('should show fallback format when native dims not loaded', () => {
    const { outputWidth, outputHeight, label } = computeIconDimensions(15, 1080, null, null);
    expect(outputWidth).toBe(162);
    expect(outputHeight).toBeNull();
    expect(label).toBe('162 px wide');
  });

  it('should handle 0% width edge case', () => {
    const { outputWidth, outputHeight, label } = computeIconDimensions(0, 1080, 100, 100);
    expect(outputWidth).toBe(0);
    expect(outputHeight).toBe(0);
    // outputHeight of 0 is falsy, so label uses fallback format
    expect(label).toBe('0 px wide');
  });

  it('should compute correct dimensions for non-square aspect ratio', () => {
    // 1920x1080 template, 10% width, 16:9 native ratio
    const { outputWidth, outputHeight, label } = computeIconDimensions(10, 1920, 16, 9);
    expect(outputWidth).toBe(192);
    expect(outputHeight).toBe(108);
    expect(label).toBe('192 × 108 px');
  });
});
