import { useState, useCallback } from 'react';
import { fromUrl, addDecoder, BaseDecoder } from 'geotiff';
import { decompress as zstdDecompress } from 'fzstd';
import { BoundingBox, EmbeddingData, TileInfo } from '../types';
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
      return new Int8Array(dataBuffer);
    }
    return new Int8Array(buffer);
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
}

export function useCOGLoader(): UseCOGLoaderResult {
  const [embeddingData, setEmbeddingData] = useState<EmbeddingData | null>(null);
  const [currentTile, setCurrentTile] = useState<TileInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEmbeddings = useCallback(async (bbox: BoundingBox): Promise<EmbeddingData> => {
    setIsLoading(true);
    setError(null);
    ensureDecoderRegistered();

    try {
      const tileResult = await findTileForBoundingBox(bbox);
      if (!tileResult) {
        throw new Error('No tile found for the selected area. Try selecting a different location.');
      }

      const { tile, fullyContained } = tileResult;
      if (!fullyContained) {
        console.warn('Bounding box extends beyond tile boundaries. Data may be clipped.');
      }

      setCurrentTile(tile);

      const origin = getTileOrigin(tile);
      const pixelSize = 10;
      const [windowX, windowY, windowWidth, windowHeight] = bboxToPixelWindow(
        bbox,
        origin.x,
        origin.y,
        pixelSize
      );

      if (windowWidth <= 0 || windowHeight <= 0) {
        throw new Error('Invalid bounding box dimensions');
      }

      const tiff = await fromUrl(tile.url);
      const image = await tiff.getImage();

      const rasterData = await image.readRasters({
        window: [windowX, windowY, windowX + windowWidth, windowY + windowHeight],
        interleave: true,
      });

      const rawData = rasterData as unknown as Int8Array;

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

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load embeddings';
      setError(message);
      setIsLoading(false);
      throw err;
    }
  }, []);

  return {
    loadEmbeddings,
    embeddingData,
    currentTile,
    isLoading,
    error,
  };
}
