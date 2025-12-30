/**
 * Viridis colormap implementation
 * Maps values in [0, 1] to RGB colors using the Viridis perceptually uniform colormap
 */

export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];
export type ColorStop = [number, RGB];

// Viridis color stops (value, [r, g, b])
const VIRIDIS_STOPS: ColorStop[] = [
  [0.0, [68, 1, 84]],     // purple
  [0.25, [59, 82, 139]],  // blue
  [0.5, [33, 145, 140]],  // teal
  [0.75, [94, 201, 98]],  // green
  [1.0, [253, 231, 37]],  // yellow
];

/**
 * Interpolate between two RGB colors
 */
function interpolateColor(color1: RGB, color2: RGB, t: number): RGB {
  return [
    Math.round(color1[0] + (color2[0] - color1[0]) * t),
    Math.round(color1[1] + (color2[1] - color1[1]) * t),
    Math.round(color1[2] + (color2[2] - color1[2]) * t),
  ];
}

/**
 * Map a value in [0, 1] to a Viridis RGB color
 * Values outside [0, 1] are clamped
 */
export function viridis(value: number): RGB {
  // Clamp to [0, 1]
  const v = Math.max(0, Math.min(1, value));

  // Find the two color stops to interpolate between
  for (let i = 0; i < VIRIDIS_STOPS.length - 1; i++) {
    const [v1, c1] = VIRIDIS_STOPS[i];
    const [v2, c2] = VIRIDIS_STOPS[i + 1];

    if (v >= v1 && v <= v2) {
      const t = (v - v1) / (v2 - v1);
      return interpolateColor(c1, c2, t);
    }
  }

  // Fallback (should never reach here with valid input)
  return VIRIDIS_STOPS[VIRIDIS_STOPS.length - 1][1];
}

/**
 * Convert similarity scores to RGBA image data
 *
 * @param scores - Float32Array of similarity scores (W x H)
 * @param width - Image width
 * @param height - Image height
 * @param threshold - Minimum score to display (0-1)
 * @param binaryMask - If true, show only above/below threshold; if false, show gradient
 * @param opacity - Overall opacity (0-1)
 * @returns Uint8ClampedArray suitable for ImageData (W x H x 4 RGBA)
 */
export function scoresToRGBA(
  scores: Float32Array,
  width: number,
  height: number,
  threshold: number,
  binaryMask: boolean,
  opacity: number
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const baseAlpha = Math.round(opacity * 255);

  for (let i = 0; i < scores.length; i++) {
    const score = scores[i];
    const rgbaIdx = i * 4;

    // Masked pixels (negative scores) are fully transparent
    if (score < 0) {
      rgba[rgbaIdx] = 0;
      rgba[rgbaIdx + 1] = 0;
      rgba[rgbaIdx + 2] = 0;
      rgba[rgbaIdx + 3] = 0;
      continue;
    }

    // Clamp score to [0, 1] for colormap
    const clampedScore = Math.max(0, Math.min(1, score));

    if (binaryMask) {
      // Binary mode: opaque if above threshold, transparent if below
      if (clampedScore >= threshold) {
        const [r, g, b] = viridis(clampedScore);
        rgba[rgbaIdx] = r;
        rgba[rgbaIdx + 1] = g;
        rgba[rgbaIdx + 2] = b;
        rgba[rgbaIdx + 3] = baseAlpha;
      } else {
        rgba[rgbaIdx] = 0;
        rgba[rgbaIdx + 1] = 0;
        rgba[rgbaIdx + 2] = 0;
        rgba[rgbaIdx + 3] = 0;
      }
    } else {
      // Gradient mode: show all scores with gradient, but fade out below threshold
      const [r, g, b] = viridis(clampedScore);
      rgba[rgbaIdx] = r;
      rgba[rgbaIdx + 1] = g;
      rgba[rgbaIdx + 2] = b;

      // Fade out scores below threshold
      if (clampedScore < threshold) {
        // Linear fade from 0 at score=0 to baseAlpha at score=threshold
        const fadeAlpha = Math.round((clampedScore / threshold) * baseAlpha * 0.3);
        rgba[rgbaIdx + 3] = fadeAlpha;
      } else {
        rgba[rgbaIdx + 3] = baseAlpha;
      }
    }
  }

  return rgba;
}
