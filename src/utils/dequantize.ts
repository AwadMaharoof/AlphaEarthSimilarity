import { CONFIG } from '../constants';

/**
 * Dequantize Int8 embeddings to Float32
 *
 * The COG stores quantized embeddings as Int8 values.
 * Formula: float = sign(raw) * (raw / 127.5)^2
 * -128 is used as a mask value (no valid data)
 *
 * @param data - Int8Array of quantized embeddings (W x H x 64)
 * @param width - Width of the raster
 * @param height - Height of the raster
 * @returns Object with dequantized Float32Array and boolean mask
 */
export function dequantize(
  data: Int8Array,
  width: number,
  height: number
): { embeddings: Float32Array; mask: boolean[] } {
  const bands = CONFIG.EMBEDDING_BANDS;
  const numPixels = width * height;
  const embeddings = new Float32Array(numPixels * bands);
  const mask: boolean[] = new Array(numPixels).fill(true);

  for (let pixelIdx = 0; pixelIdx < numPixels; pixelIdx++) {
    const baseIdx = pixelIdx * bands;
    let isValid = true;

    // First pass: dequantize
    for (let band = 0; band < bands; band++) {
      const raw = data[baseIdx + band];

      // -128 indicates masked/invalid pixel
      if (raw === -128) {
        isValid = false;
        embeddings[baseIdx + band] = 0;
      } else {
        // Dequantize: float = sign(raw) * (raw / 127.5)^2
        const sign = raw >= 0 ? 1 : -1;
        const absNormalized = Math.abs(raw) / 127.5;
        embeddings[baseIdx + band] = sign * absNormalized * absNormalized;
      }
    }

    mask[pixelIdx] = isValid;

    // Second pass: normalize to unit length (as Google intended)
    if (isValid) {
      let magnitude = 0;
      for (let band = 0; band < bands; band++) {
        const val = embeddings[baseIdx + band];
        magnitude += val * val;
      }
      magnitude = Math.sqrt(magnitude);

      if (magnitude > 0) {
        for (let band = 0; band < bands; band++) {
          embeddings[baseIdx + band] /= magnitude;
        }
      }
    }
  }

  return { embeddings, mask };
}

/**
 * Extract a single pixel's embedding vector
 */
export function extractEmbeddingVector(
  embeddings: Float32Array,
  pixelX: number,
  pixelY: number,
  width: number
): Float32Array {
  const bands = CONFIG.EMBEDDING_BANDS;
  const pixelIdx = pixelY * width + pixelX;
  const baseIdx = pixelIdx * bands;

  const vector = new Float32Array(bands);
  for (let i = 0; i < bands; i++) {
    vector[i] = embeddings[baseIdx + i];
  }

  return vector;
}
