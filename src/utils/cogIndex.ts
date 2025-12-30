import { TileInfo, BoundingBox } from '../types';
import { CONFIG } from '../constants';
import { getUTMZone } from './coordinates';
import { load } from '@loaders.gl/core';
import { ParquetLoader } from '@loaders.gl/parquet';

let cachedTiles: TileInfo[] | null = null;

/**
 * Convert S3 URL to HTTPS URL
 * s3://us-west-2.opendata.source.coop/... -> https://data.source.coop/...
 */
function s3ToHttps(s3Url: string): string {
  return s3Url.replace(
    /^s3:\/\/[^/]*\.opendata\.source\.coop\//,
    'https://data.source.coop/'
  );
}

/**
 * Parquet row schema matching aef_index.parquet
 * Note: string fields may come as Uint8Array/Buffer depending on parquet loader version
 */
interface ParquetRow {
  crs: string;
  path: string | Uint8Array;  // S3 URL, may be binary
  year: string;
  utm_zone: string;
  utm_west: string;
  utm_south: string;
  utm_east: string;
  utm_north: string;
  wgs84_west: string;
  wgs84_south: string;
  wgs84_east: string;
  wgs84_north: string;
}

/**
 * Decode a field that may be a string or Uint8Array
 */
function decodeField(value: string | Uint8Array): string {
  if (typeof value === 'string') {
    return value;
  }
  return new TextDecoder().decode(value);
}

/**
 * Fetch and parse the COG index from GeoParquet
 */
export async function fetchCOGIndex(): Promise<TileInfo[]> {
  if (cachedTiles) {
    return cachedTiles;
  }

  const data = await load(CONFIG.COG_INDEX_URL, ParquetLoader, {
    parquet: {
      shape: 'object-row-table',
    },
  });

  const tiles: TileInfo[] = [];
  // Handle different return shapes from ParquetLoader
  const rows = Array.isArray(data) ? data : (data as { data: unknown[] }).data;

  for (const row of rows as ParquetRow[]) {
    // Filter by target year
    if (row.year !== CONFIG.TARGET_YEAR) continue;

    try {
      // Decode path (may be string or Uint8Array)
      const s3Path = decodeField(row.path);
      const httpsUrl = s3ToHttps(s3Path);

      // Parse WGS84 bounds (stored as strings)
      const lngLatBounds: BoundingBox = {
        minLng: parseFloat(row.wgs84_west),
        minLat: parseFloat(row.wgs84_south),
        maxLng: parseFloat(row.wgs84_east),
        maxLat: parseFloat(row.wgs84_north),
      };

      tiles.push({
        wkt: '',
        crs: row.crs,
        url: httpsUrl,
        year: row.year,
        utmZone: row.utm_zone,
        utmBounds: {
          minX: parseFloat(row.utm_west),
          minY: parseFloat(row.utm_south),
          maxX: parseFloat(row.utm_east),
          maxY: parseFloat(row.utm_north),
        },
        lngLatBounds,
      });
    } catch (e) {
      console.warn('Failed to parse row:', e, row);
    }
  }

  cachedTiles = tiles;
  return tiles;
}

/**
 * Check if a bounding box is fully contained within a tile's lat/lng bounds
 */
function bboxContainedInTile(bbox: BoundingBox, tile: TileInfo): boolean {
  return (
    bbox.minLng >= tile.lngLatBounds.minLng &&
    bbox.maxLng <= tile.lngLatBounds.maxLng &&
    bbox.minLat >= tile.lngLatBounds.minLat &&
    bbox.maxLat <= tile.lngLatBounds.maxLat
  );
}

/**
 * Check if a point is within a tile's lat/lng bounds
 */
function pointInTile(lng: number, lat: number, tile: TileInfo): boolean {
  return (
    lng >= tile.lngLatBounds.minLng &&
    lng <= tile.lngLatBounds.maxLng &&
    lat >= tile.lngLatBounds.minLat &&
    lat <= tile.lngLatBounds.maxLat
  );
}

/**
 * Find the tile containing the center of a bounding box
 */
export async function findTileForBoundingBox(
  bbox: BoundingBox
): Promise<{ tile: TileInfo; fullyContained: boolean } | null> {
  const tiles = await fetchCOGIndex();

  const centerLng = (bbox.minLng + bbox.maxLng) / 2;
  const centerLat = (bbox.minLat + bbox.maxLat) / 2;

  const minZone = getUTMZone(bbox.minLng);
  const maxZone = getUTMZone(bbox.maxLng);

  if (minZone !== maxZone) {
    throw new Error('Bounding box crosses UTM zone boundary');
  }

  // Find tile containing the center point
  for (const tile of tiles) {
    if (pointInTile(centerLng, centerLat, tile)) {
      const fullyContained = bboxContainedInTile(bbox, tile);
      return { tile, fullyContained };
    }
  }

  return null;
}

/**
 * Get tile origin in UTM coordinates.
 * For bottom-up COGs (standard GeoTIFF), pixel (0,0) is at the SW corner (minX, minY).
 * Returns the SW corner coordinates.
 */
export function getTileOrigin(tile: TileInfo): { x: number; y: number } {
  // Use the UTM bounds directly from the tile metadata
  // This is the SW corner where pixel (0,0) is located in a bottom-up COG
  return {
    x: tile.utmBounds.minX,
    y: tile.utmBounds.minY,
  };
}

/**
 * Clear the cached tiles (useful for testing or forcing a refresh)
 */
export function clearTileCache(): void {
  cachedTiles = null;
}
