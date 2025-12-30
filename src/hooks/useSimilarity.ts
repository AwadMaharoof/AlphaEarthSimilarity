import { useState, useCallback } from 'react';
import { EmbeddingData, ReferencePixel, SimilarityResult } from '../types';
import { latLngToPixel } from '../utils/coordinates';
import { extractEmbeddingVector, normalizeVector } from '../utils/dequantize';
import { getTileOrigin } from '../utils/cogIndex';
import type { TileInfo } from '../types';

interface UseSimilarityResult {
  referencePixel: ReferencePixel | null;
  similarityResult: SimilarityResult | null;
  selectReferencePixel: (
    lng: number,
    lat: number,
    embeddingData: EmbeddingData,
    tile: TileInfo
  ) => { success: boolean; error?: string };
  clearReference: () => void;
  isCalculating: boolean;
}

/**
 * Calculate cosine similarity between reference vector and all pixels
 * Cosine similarity = (A · B) / (|A| * |B|)
 */
function calculateSimilarityScores(
  embeddings: Float32Array,
  mask: boolean[],
  refVector: Float32Array,
  width: number,
  height: number
): Float32Array {
  const numPixels = width * height;
  const bands = 64;
  const scores = new Float32Array(numPixels);

  // Normalize the reference vector for cosine similarity
  const normalizedRef = normalizeVector(refVector);

  for (let pixelIdx = 0; pixelIdx < numPixels; pixelIdx++) {
    // Skip masked pixels
    if (!mask[pixelIdx]) {
      scores[pixelIdx] = -1; // Mark as invalid
      continue;
    }

    const baseIdx = pixelIdx * bands;
    let dotProduct = 0;
    let magnitude = 0;

    // Calculate dot product and magnitude simultaneously
    for (let band = 0; band < bands; band++) {
      const val = embeddings[baseIdx + band];
      dotProduct += val * normalizedRef[band];
      magnitude += val * val;
    }

    magnitude = Math.sqrt(magnitude);

    // Cosine similarity (avoid division by zero)
    if (magnitude > 0) {
      scores[pixelIdx] = dotProduct / magnitude;
    } else {
      scores[pixelIdx] = 0;
    }
  }

  return scores;
}

export function useSimilarity(): UseSimilarityResult {
  const [referencePixel, setReferencePixel] = useState<ReferencePixel | null>(null);
  const [similarityResult, setSimilarityResult] = useState<SimilarityResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const selectReferencePixel = useCallback(
    (
      lng: number,
      lat: number,
      embeddingData: EmbeddingData,
      tile: TileInfo
    ): { success: boolean; error?: string } => {
      setIsCalculating(true);

      try {
        // Convert click coordinates to pixel coordinates
        const origin = getTileOrigin(tile);
        const pixelCoord = latLngToPixel(lat, lng, origin.x, origin.y, 10);

        // Calculate pixel position relative to the loaded window (not the full tile)
        // We need to offset by the window origin
        const windowOrigin = latLngToPixel(
          embeddingData.bounds.maxLat,
          embeddingData.bounds.minLng,
          origin.x,
          origin.y,
          10
        );

        const localX = pixelCoord.x - windowOrigin.x;
        const localY = pixelCoord.y - windowOrigin.y;

        // Validate pixel is within bounds
        if (
          localX < 0 ||
          localX >= embeddingData.width ||
          localY < 0 ||
          localY >= embeddingData.height
        ) {
          setIsCalculating(false);
          return {
            success: false,
            error: 'Click is outside the loaded embedding region',
          };
        }

        // Check if pixel is masked
        const pixelIdx = localY * embeddingData.width + localX;
        if (!embeddingData.mask[pixelIdx]) {
          setIsCalculating(false);
          return {
            success: false,
            error: 'Selected pixel has no valid data (masked)',
          };
        }

        // Extract the embedding vector at this pixel
        const vector = extractEmbeddingVector(
          embeddingData.embeddings,
          localX,
          localY,
          embeddingData.width
        );

        // Store reference pixel
        const refPixel: ReferencePixel = {
          lng,
          lat,
          pixelX: localX,
          pixelY: localY,
          vector,
        };
        setReferencePixel(refPixel);

        // Calculate similarity scores for all pixels
        const scores = calculateSimilarityScores(
          embeddingData.embeddings,
          embeddingData.mask,
          vector,
          embeddingData.width,
          embeddingData.height
        );

        // Store similarity result
        const result: SimilarityResult = {
          scores,
          width: embeddingData.width,
          height: embeddingData.height,
          bounds: embeddingData.bounds,
        };
        setSimilarityResult(result);
        setIsCalculating(false);

        return { success: true };
      } catch (err) {
        setIsCalculating(false);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to calculate similarity',
        };
      }
    },
    []
  );

  const clearReference = useCallback(() => {
    setReferencePixel(null);
    setSimilarityResult(null);
  }, []);

  return {
    referencePixel,
    similarityResult,
    selectReferencePixel,
    clearReference,
    isCalculating,
  };
}
