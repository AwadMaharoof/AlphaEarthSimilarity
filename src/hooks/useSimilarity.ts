import { useState, useCallback, useRef, useEffect } from 'react';
import { EmbeddingData, ReferencePixel, SimilarityResult, BoundingBox } from '../types';
import { latLngToPixel } from '../utils/coordinates';
import { extractEmbeddingVector } from '../utils/dequantize';
import { getTileOrigin } from '../utils/cogIndex';
import { createPolygonMask } from '../utils/polygonMask';
import { CONFIG } from '../constants';
import type { TileInfo } from '../types';
import type { WorkerResponse } from '../workers/similarity.worker';
import SimilarityWorker from '../workers/similarity.worker?worker';

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
  initWorker: (embeddingData: EmbeddingData) => void;
}

export function useSimilarity(): UseSimilarityResult {
  const [referencePixel, setReferencePixel] = useState<ReferencePixel | null>(null);
  const [similarityResult, setSimilarityResult] = useState<SimilarityResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isWorkerReady, setIsWorkerReady] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const pendingResultRef = useRef<{
    bounds: BoundingBox;
    width: number;
    height: number;
  } | null>(null);

  // Initialize worker on mount
  useEffect(() => {
    const worker = new SimilarityWorker();

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === 'ready') {
        setIsWorkerReady(true);
      } else if (e.data.type === 'result') {
        // Ignore stale results
        if (e.data.requestId === requestIdRef.current && pendingResultRef.current) {
          const result: SimilarityResult = {
            scores: e.data.scores,
            width: pendingResultRef.current.width,
            height: pendingResultRef.current.height,
            bounds: pendingResultRef.current.bounds,
          };
          setSimilarityResult(result);
          setIsCalculating(false);
          pendingResultRef.current = null;
        }
      } else if (e.data.type === 'error') {
        console.error('Worker error:', e.data.message);
        setIsCalculating(false);
        pendingResultRef.current = null;
      }
    };

    worker.onerror = (e) => {
      console.error('Worker error:', e);
      setIsCalculating(false);
      pendingResultRef.current = null;
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  // Initialize worker with embeddings
  const initWorker = useCallback((embeddingData: EmbeddingData) => {
    if (!workerRef.current) return;

    setIsWorkerReady(false);

    // Convert boolean[] to Uint8Array
    const maskArray = new Uint8Array(embeddingData.mask.map(b => b ? 1 : 0));

    // Create polygon mask if custom shape was drawn
    const polygonMask = createPolygonMask(
      embeddingData.bounds,
      embeddingData.width,
      embeddingData.height
    );
    const polygonMaskArray = polygonMask
      ? new Uint8Array(polygonMask.map(b => b ? 1 : 0))
      : null;

    workerRef.current.postMessage({
      type: 'init',
      embeddings: embeddingData.embeddings,
      mask: maskArray,
      polygonMask: polygonMaskArray,
      width: embeddingData.width,
      height: embeddingData.height,
    });
  }, []);

  const selectReferencePixel = useCallback(
    (
      lng: number,
      lat: number,
      embeddingData: EmbeddingData,
      tile: TileInfo
    ): { success: boolean; error?: string } => {
      if (!workerRef.current || !isWorkerReady) {
        return { success: false, error: 'Worker not ready' };
      }

      try {
        // Convert click coordinates to pixel coordinates in native COG order
        const origin = getTileOrigin(tile);
        const pixelCoord = latLngToPixel(lat, lng, origin.x, origin.y, CONFIG.PIXEL_SIZE);

        // Calculate the SW corner of the window (smallest pixel coords in native order)
        const windowSW = latLngToPixel(
          embeddingData.bounds.minLat,
          embeddingData.bounds.minLng,
          origin.x,
          origin.y,
          CONFIG.PIXEL_SIZE
        );

        // Local coordinates in native COG order (row 0 = south)
        const localX = pixelCoord.x - windowSW.x;
        const nativeLocalY = pixelCoord.y - windowSW.y;

        // After flipVertical, row 0 is north, so we need to flip Y
        const localY = (embeddingData.height - 1) - nativeLocalY;

        // Validate pixel is within bounds
        if (
          localX < 0 ||
          localX >= embeddingData.width ||
          localY < 0 ||
          localY >= embeddingData.height
        ) {
          return {
            success: false,
            error: 'Click outside loaded area. Please click within the bounding box.',
          };
        }

        // Check if pixel is masked
        const pixelIdx = localY * embeddingData.width + localX;
        if (!embeddingData.mask[pixelIdx]) {
          return {
            success: false,
            error: 'No data for this pixel (cloud, water, or masked area). Try clicking a different location.',
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

        // Store pending result metadata for when worker responds
        pendingResultRef.current = {
          bounds: embeddingData.bounds,
          width: embeddingData.width,
          height: embeddingData.height,
        };

        // Send calculation request to worker
        setIsCalculating(true);
        requestIdRef.current++;

        workerRef.current.postMessage({
          type: 'calculate',
          refVector: vector,
          requestId: requestIdRef.current,
        });

        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to calculate similarity',
        };
      }
    },
    [isWorkerReady]
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
    initWorker,
  };
}
