import { useState, useCallback } from 'react';
import { fromUrl } from 'geotiff';
import { BoundingBox, EmbeddingData, TileInfo } from '../types';
import { findTileForBoundingBox, getTileOrigin } from '../utils/cogIndex';
import { bboxToPixelWindow } from '../utils/coordinates';
import { flipVertical } from '../utils/flipVertical';
import { dequantize } from '../utils/dequantize';
import { CONFIG } from '../constants';

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

    try {
      // Find the tile that contains this bounding box
      const tileResult = await findTileForBoundingBox(bbox);
      if (!tileResult) {
        throw new Error('No tile found for the selected area. Try selecting a different location.');
      }

      const { tile, fullyContained } = tileResult;
      if (!fullyContained) {
        console.warn('Bounding box extends beyond tile boundaries. Data may be clipped.');
      }

      setCurrentTile(tile);

      // Get tile origin in UTM
      const origin = getTileOrigin(tile);

      // Calculate pixel window for the bounding box
      // Pixel size is 10m for AEF tiles
      const pixelSize = 10;
      const [windowX, windowY, windowWidth, windowHeight] = bboxToPixelWindow(
        bbox,
        origin.x,
        origin.y,
        pixelSize
      );

      // Validate window dimensions
      if (windowWidth <= 0 || windowHeight <= 0) {
        throw new Error('Invalid bounding box dimensions');
      }

      // Open the COG file
      const tiff = await fromUrl(tile.url);
      const image = await tiff.getImage();

      // Get the raster window
      // geotiff.js uses [left, top, right, bottom] for window
      const rasterData = await image.readRasters({
        window: [windowX, windowY, windowX + windowWidth, windowY + windowHeight],
        interleave: true,
      });

      // The data comes as TypedArray - we need Int8Array
      const rawData = rasterData as unknown as Int8Array;

      // Flip vertically (COGs are stored bottom-up)
      const flippedData = flipVertical(
        rawData,
        windowWidth,
        windowHeight,
        CONFIG.EMBEDDING_BANDS
      );

      // Dequantize to Float32
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
