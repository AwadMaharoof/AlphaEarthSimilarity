import { TileInfo, BoundingBox } from '../types';
import { CONFIG } from '../constants';
import { getUTMZone, parseUTMZone } from './coordinates';

let cachedTiles: TileInfo[] | null = null;

/**
 * Parse WKT POLYGON to extract bounding box in UTM coordinates
 * Format: "POLYGON ((minX minY, maxX minY, maxX maxY, minX maxY, minX minY))"
 */
function parseWKTBounds(wkt: string): { minX: number; minY: number; maxX: number; maxY: number } {
  // Remove quotes if present
  const cleanWkt = wkt.replace(/^"|"$/g, '');

  // Extract coordinates from POLYGON ((x1 y1, x2 y2, ...))
  const match = cleanWkt.match(/POLYGON\s*\(\(([\d\s.,+-]+)\)\)/i);
  if (!match) {
    throw new Error(`Invalid WKT format: ${wkt}`);
  }

  const coordPairs = match[1].split(',').map((pair) => {
    const [x, y] = pair.trim().split(/\s+/).map(Number);
    return { x, y };
  });

  const xs = coordPairs.map((c) => c.x);
  const ys = coordPairs.map((c) => c.y);

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
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
 * Convert UTM bounds to approximate lat/lng bounds
 * This is an approximation using the inverse of the UTM projection
 */
function utmBoundsToLatLng(
  utmBounds: { minX: number; minY: number; maxX: number; maxY: number },
  utmZone: string
): BoundingBox {
  const { zone, hemisphere } = parseUTMZone(utmZone);

  // Approximate inverse UTM to lat/lng
  // Central meridian for the zone
  const lng0 = (zone - 1) * 6 - 180 + 3;

  // WGS84 parameters
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e = Math.sqrt(2 * f - f * f);
  const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));

  function utmToLatLng(easting: number, northing: number): { lat: number; lng: number } {
    const x = easting - 500000;
    let y = northing;
    if (hemisphere === 'S') {
      y -= 10000000;
    }

    const M = y / k0;
    const mu = M / (a * (1 - e * e / 4 - 3 * e * e * e * e / 64 - 5 * e * e * e * e * e * e / 256));

    const phi1 =
      mu +
      ((3 * e1) / 2 - (27 * e1 * e1 * e1) / 32) * Math.sin(2 * mu) +
      ((21 * e1 * e1) / 16 - (55 * e1 * e1 * e1 * e1) / 32) * Math.sin(4 * mu) +
      ((151 * e1 * e1 * e1) / 96) * Math.sin(6 * mu);

    const N1 = a / Math.sqrt(1 - e * e * Math.sin(phi1) * Math.sin(phi1));
    const T1 = Math.tan(phi1) * Math.tan(phi1);
    const C1 = ((e * e) / (1 - e * e)) * Math.cos(phi1) * Math.cos(phi1);
    const R1 =
      (a * (1 - e * e)) /
      Math.pow(1 - e * e * Math.sin(phi1) * Math.sin(phi1), 1.5);
    const D = x / (N1 * k0);

    const lat =
      phi1 -
      ((N1 * Math.tan(phi1)) / R1) *
        ((D * D) / 2 -
          ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * (e * e / (1 - e * e))) *
            D *
            D *
            D *
            D) /
            24 +
          ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * (e * e / (1 - e * e)) - 3 * C1 * C1) *
            D *
            D *
            D *
            D *
            D *
            D) /
            720);

    const lng =
      lng0 +
      ((180 / Math.PI) *
        (D -
          ((1 + 2 * T1 + C1) * D * D * D) / 6 +
          ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * (e * e / (1 - e * e)) + 24 * T1 * T1) *
            D *
            D *
            D *
            D *
            D) /
            120)) /
      Math.cos(phi1);

    return { lat: (lat * 180) / Math.PI, lng };
  }

  const sw = utmToLatLng(utmBounds.minX, utmBounds.minY);
  const ne = utmToLatLng(utmBounds.maxX, utmBounds.maxY);

  return {
    minLng: sw.lng,
    minLat: sw.lat,
    maxLng: ne.lng,
    maxLat: ne.lat,
  };
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
      const utmBounds = parseWKTBounds(wkt);
      const utmZone = extractUTMZoneFromCRS(crs);
      const httpsUrl = s3ToHttps(url);
      const lngLatBounds = utmBoundsToLatLng(utmBounds, utmZone);

      tiles.push({
        wkt,
        crs,
        url: httpsUrl,
        year,
        utmZone,
        utmBounds,
        lngLatBounds,
      });
    } catch (error) {
      console.warn(`Skipping invalid tile entry: ${error}`);
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
 * Returns null if no tile found
 */
export async function findTileForBoundingBox(
  bbox: BoundingBox
): Promise<{ tile: TileInfo; fullyContained: boolean } | null> {
  const tiles = await fetchCOGIndex();

  const centerLng = (bbox.minLng + bbox.maxLng) / 2;
  const centerLat = (bbox.minLat + bbox.maxLat) / 2;

  // Ensure the bounding box is in a single UTM zone
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
  return {
    x: tile.utmBounds.minX,
    y: tile.utmBounds.maxY, // Top edge (max Y in UTM)
  };
}

/**
 * Clear the cached tiles (useful for testing or forcing a refresh)
 */
export function clearTileCache(): void {
  cachedTiles = null;
}
