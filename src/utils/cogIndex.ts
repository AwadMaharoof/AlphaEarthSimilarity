import { TileInfo, BoundingBox } from '../types';
import { CONFIG } from '../constants';
import { getUTMZone, latLngToUTM } from './coordinates';

let cachedTiles: TileInfo[] | null = null;

/**
 * Parse WKT POLYGON to extract bounding box
 * The WKT is in WGS84 (EPSG:4326) format: POLYGON((lng lat, lng lat, ...))
 */
function parseWKTBounds(wkt: string): BoundingBox {
  // Remove quotes if present
  const cleanWkt = wkt.replace(/^"|"$/g, '');

  const match = cleanWkt.match(/POLYGON\s*\(\(([\d\s.,+-]+)\)\)/i);
  if (!match) {
    throw new Error(`Invalid WKT format: ${wkt}`);
  }

  const coordPairs = match[1].split(',').map((pair) => {
    const [lng, lat] = pair.trim().split(/\s+/).map(Number);
    return { lng, lat };
  });

  const lngs = coordPairs.map((c) => c.lng);
  const lats = coordPairs.map((c) => c.lat);

  return {
    minLng: Math.min(...lngs),
    minLat: Math.min(...lats),
    maxLng: Math.max(...lngs),
    maxLat: Math.max(...lats),
  };
}

/**
 * Extract UTM zone from CRS string
 * Format: "EPSG:326XX" (north) or "EPSG:327XX" (south)
 */
function extractUTMZoneFromCRS(crs: string): string {
  const match = crs.match(/EPSG:32([67])(\d{2})/);
  if (!match) {
    throw new Error(`Cannot parse UTM zone from CRS: ${crs}`);
  }
  const hemisphere = match[1] === '6' ? 'N' : 'S';
  const zone = parseInt(match[2], 10);
  return `${zone}${hemisphere}`;
}

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
 * Parse a CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

/**
 * Fetch and parse the COG index CSV
 */
export async function fetchCOGIndex(): Promise<TileInfo[]> {
  if (cachedTiles) {
    return cachedTiles;
  }

  const response = await fetch(CONFIG.COG_INDEX_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch COG index: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const lines = text.trim().split('\n');

  const tiles: TileInfo[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const fields = parseCSVLine(line);
    if (fields.length < 4) continue;

    // CSV format: WKT, CRS, URL, Year (no header)
    const [wkt, crs, url, year] = fields;

    // Filter by target year
    if (year !== CONFIG.TARGET_YEAR) continue;

    try {
      const lngLatBounds = parseWKTBounds(wkt);
      const utmZone = extractUTMZoneFromCRS(crs);
      const httpsUrl = s3ToHttps(url);

      tiles.push({
        wkt,
        crs,
        url: httpsUrl,
        year,
        utmZone,
        utmBounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
        lngLatBounds,
      });
    } catch {
      // Skip invalid entries silently
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
 * Get tile origin in UTM coordinates (top-left corner)
 */
export function getTileOrigin(tile: TileInfo): { x: number; y: number } {
  const topLeftUTM = latLngToUTM(tile.lngLatBounds.maxLat, tile.lngLatBounds.minLng);
  return {
    x: topLeftUTM.easting,
    y: topLeftUTM.northing,
  };
}

/**
 * Clear the cached tiles (useful for testing or forcing a refresh)
 */
export function clearTileCache(): void {
  cachedTiles = null;
}
