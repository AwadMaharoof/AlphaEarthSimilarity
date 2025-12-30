/**
 * Viridis colormap implementation
 * Maps values in [0, 1] to RGB colors using the Viridis perceptually uniform colormap
 */

type RGB = [number, number, number];
type ColorStop = [number, RGB];

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
 * Compute min and max of valid (non-negative) scores
 */
function computeScoreRange(scores: Float32Array): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < scores.length; i++) {
    const score = scores[i];
    if (score >= 0) {
      if (score < min) min = score;
      if (score > max) max = score;
    }
  }

  // Handle edge cases
  if (min === Infinity) min = 0;
  if (max === -Infinity) max = 1;
  if (min === max) {
    // All scores identical - create artificial range
    min = max - 0.1;
    if (min < 0) min = 0;
  }

  return { min, max };
}

/**
 * Convert similarity scores to RGBA image data
 *
 * Scores are dynamically scaled to use the full color range, since
 * cosine similarity in homogeneous regions can have very narrow ranges
 * (e.g., 0.998 to 1.000).
 *
 * @param scores - Float32Array of similarity scores (W x H)
 * @param width - Image width
 * @param height - Image height
 * @param threshold - Minimum score to display (0-1, relative to score range)
 * @param opacity - Overall opacity (0-1)
 * @returns Uint8ClampedArray suitable for ImageData (W x H x 4 RGBA)
 */
export function scoresToRGBA(
  scores: Float32Array,
  width: number,
  height: number,
  threshold: number,
  opacity: number
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const baseAlpha = Math.round(opacity * 255);

  // Compute the actual score range for dynamic scaling
  const { min: scoreMin, max: scoreMax } = computeScoreRange(scores);
  const scoreRange = scoreMax - scoreMin;

  // Convert threshold from [0,1] UI range to actual score value
  const actualThreshold = scoreMin + threshold * scoreRange;

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

    // Normalize score to [0, 1] based on actual range for colormap
    const normalizedScore = scoreRange > 0
      ? (score - scoreMin) / scoreRange
      : 0.5;

    // Show pixels above threshold, hide those below
    if (score >= actualThreshold) {
      const [r, g, b] = viridis(normalizedScore);
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
  }

  return rgba;
}
