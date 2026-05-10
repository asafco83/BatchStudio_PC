/**
 * Compute the output pixel dimensions of an icon overlay.
 * @param {number} widthPct - Icon width as percentage (0-100)
 * @param {number} templateW - Template output width in pixels
 * @param {number|null} nativeW - Icon native width (null if not loaded)
 * @param {number|null} nativeH - Icon native height (null if not loaded)
 * @returns {{ outputWidth: number, outputHeight: number|null, label: string }}
 */
export function computeIconDimensions(widthPct, templateW, nativeW, nativeH) {
  const outputWidth = Math.round(widthPct / 100 * templateW);
  const outputHeight = (nativeW && nativeH)
    ? Math.round(outputWidth * nativeH / nativeW)
    : null;
  const label = outputHeight
    ? `${outputWidth} × ${outputHeight} px`
    : `${outputWidth} px wide`;
  return { outputWidth, outputHeight, label };
}

/**
 * Clamp the requested icon width percentage to respect minimum constraints.
 * @param {number} requestedW - Requested width percentage
 * @param {number|null} minWidthPx - Configured minimum width in pixels (null if not set)
 * @param {number} canvasWidth - Canvas width in pixels
 * @returns {number} Clamped width percentage
 */
export function clampIconWidth(requestedW, minWidthPx, canvasWidth) {
  const minWPercent = minWidthPx != null ? (minWidthPx / canvasWidth) * 100 : 2;
  return Math.max(minWPercent, requestedW);
}

/**
 * Compute the center position for a new icon overlay.
 * @param {number} defaultWidth - Default icon width as percentage (0-100)
 * @returns {{ x: number, y: number }}
 */
export function computeCenterPosition(defaultWidth) {
  const x = (100 - defaultWidth) / 2;
  const y = (100 - defaultWidth) / 2;
  return { x, y };
}

/**
 * Resolve the safe area color from config, with fallback.
 * @param {object|null} config - Application config object
 * @returns {string} Resolved color string (hex8 format)
 */
export function getSafeAreaColor(config) {
  return config?.safeAreaColor || '#ef4444ff';
}
