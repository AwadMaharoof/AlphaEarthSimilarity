import { useState, useCallback } from 'react';
import { fromUrl, addDecoder, BaseDecoder } from 'geotiff';
import { decompress as zstdDecompress } from 'fzstd';
import type { BoundingBox, EmbeddingData, TileInfo, LoadingProgress } from '../types';
import { findTileForBoundingBox, getTileOrigin } from '../utils/cogIndex';
import { bboxToPixelWindow } from '../utils/coordinates';
import { flipVertical } from '../utils/flipVertical';
import { dequantize } from '../utils/dequantize';
import { CONFIG } from '../constants';

// ZSTD magic bytes
const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

function isZstdCompressed(buffer: ArrayBuffer): boolean {
  const view = new Uint8Array(buffer);
  return ZSTD_MAGIC.every((byte, i) => view[i] === byte);
}

// Custom decoder for compression code 50000 (ZSTD-compressed raw pixels)
class ZstdDecoder extends BaseDecoder {
  async decode(_fileDirectory: unknown, buffer: ArrayBuffer) {
    if (isZstdCompressed(buffer)) {
      const compressed = new Uint8Array(buffer);
      const decompressed = zstdDecompress(compressed);
      const dataBuffer = new ArrayBuffer(decompressed.byteLength);
      new Uint8Array(dataBuffer).set(decompressed);
      return dataBuffer;
    }
    return buffer;
  }
}

// Register decoder for GDAL's compression code 50000
let decoderRegistered = false;
function ensureDecoderRegistered() {
  if (decoderRegistered) return;
  decoderRegistered = true;
  addDecoder(50000, () => Promise.resolve(ZstdDecoder));
}

interface UseCOGLoaderResult {
  loadEmbeddings: (bbox: BoundingBox) => Promise<EmbeddingData>;
  embeddingData: EmbeddingData | null;
  currentTile: TileInfo | null;
  isLoading: boolean;
  error: string | null;
  loadingProgress: LoadingProgress | null;
  clearEmbeddings: () => void;
}

export function useCOGLoader(): UseCOGLoaderResult {
  const [embeddingData, setEmbeddingData] = useState<EmbeddingData | null>(null);
  const [currentTile, setCurrentTile] = useState<TileInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);

  const loadEmbeddings = useCallback(async (bbox: BoundingBox): Promise<EmbeddingData> => {
    setIsLoading(true);
    setError(null);
    setLoadingProgress({ step: 1, totalSteps: 4, message: 'Finding tile...' });
    ensureDecoderRegistered();

    try {
      let tileResult;
      try {
        tileResult = await findTileForBoundingBox(bbox);
      } catch (indexError) {
        if (indexError instanceof Error && indexError.message.includes('UTM zone')) {
          throw indexError; // Re-throw UTM zone errors as-is
        }
        throw new Error(
          'Failed to load tile index. Check your internet connection and try again.'
        );
      }

      if (!tileResult) {
        throw new Error(
          'No satellite data available for this location. ' +
          'AlphaEarth embeddings are not available everywhere. ' +
          'Try selecting a different area.'
        );
      }

      const { tile, fullyContained } = tileResult;
      if (!fullyContained) {
        console.warn('Bounding box extends beyond tile boundaries. Data may be clipped.');
      }

      setCurrentTile(tile);

      const origin = getTileOrigin(tile);
      const [windowX, windowY, windowWidth, windowHeight] = bboxToPixelWindow(
        bbox,
        origin.x,
        origin.y,
        CONFIG.PIXEL_SIZE
      );

      if (windowWidth <= 0 || windowHeight <= 0) {
        throw new Error(
          'The selected area is too small or invalid. ' +
          'Please draw a larger bounding box.'
        );
      }

      setLoadingProgress({ step: 2, totalSteps: 4, message: 'Opening COG file...' });
      let tiff;
      let image;
      try {
        tiff = await fromUrl(tile.url);
        image = await tiff.getImage();
      } catch (tiffError) {
        console.error('COG open error:', tiffError);
        throw new Error(
          'Failed to open satellite data file. ' +
          'This may be a temporary server issue. Please try again in a moment.'
        );
      }

      setLoadingProgress({ step: 3, totalSteps: 4, message: 'Downloading embeddings...' });
      let rasterData;
      try {
        rasterData = await image.readRasters({
          window: [windowX, windowY, windowX + windowWidth, windowY + windowHeight],
          interleave: true,
        });
      } catch (rasterError) {
        console.error('Raster read error:', rasterError);
        throw new Error(
          'Failed to download embedding data. ' +
          'Check your internet connection and try again.'
        );
      }

      setLoadingProgress({ step: 4, totalSteps: 4, message: 'Processing data...' });

      // Validate rasterData is a typed array with buffer access
      if (!rasterData || typeof rasterData !== 'object' || !('buffer' in rasterData)) {
        throw new Error('Unexpected raster data format from GeoTIFF library');
      }

      // Convert to Int8Array (geotiff returns Uint8Array, we need signed interpretation)
      const rasterArray = rasterData as Uint8Array;
      const rawData = new Int8Array(rasterArray.buffer, rasterArray.byteOffset, rasterArray.length);

      const flippedData = flipVertical(
        rawData,
        windowWidth,
        windowHeight,
        CONFIG.EMBEDDING_BANDS
      );

      const { embeddings, mask } = dequantize(flippedData, windowWidth, windowHeight);

      const result: EmbeddingData = {
        embeddings,
        width: windowWidth,
        height: windowHeight,
        bounds: bbox,
        mask,
      };

      setEmbeddingData(result);
      setIsLoading(false);
      setLoadingProgress(null);

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load embeddings';
      setError(message);
      setIsLoading(false);
      setLoadingProgress(null);
      throw err;
    }
  }, []);

  const clearEmbeddings = useCallback(() => {
    setEmbeddingData(null);
    setCurrentTile(null);
    setError(null);
    setLoadingProgress(null);
  }, []);

  return {
    loadEmbeddings,
    embeddingData,
    currentTile,
    isLoading,
    error,
    loadingProgress,
    clearEmbeddings,
  };
}
