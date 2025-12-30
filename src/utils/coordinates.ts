import { UTMCoord, PixelCoord, BoundingBox } from '../types';
import { CONFIG } from '../constants';

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get UTM zone number from longitude
 */
export function getUTMZone(longitude: number): number {
  return Math.floor((longitude + 180) / 6) + 1;
}

/**
 * Get hemisphere from latitude
 */
export function getHemisphere(latitude: number): 'N' | 'S' {
  return latitude >= 0 ? 'N' : 'S';
}

/**
 * Convert lat/lng to UTM coordinates
 * Uses WGS84 ellipsoid parameters
 */
export function latLngToUTM(lat: number, lng: number): UTMCoord {
  const zone = getUTMZone(lng);
  const hemisphere = getHemisphere(lat);

  // WGS84 ellipsoid parameters
  const a = 6378137.0; // semi-major axis
  const f = 1 / 298.257223563; // flattening
  const k0 = 0.9996; // scale factor

  const e = Math.sqrt(2 * f - f * f); // eccentricity
  const e2 = e * e;
  const ep2 = e2 / (1 - e2); // second eccentricity squared

  const latRad = toRad(lat);
  const lngRad = toRad(lng);

  // Central meridian for the zone
  const lng0 = toRad((zone - 1) * 6 - 180 + 3);

  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = ep2 * Math.cos(latRad) * Math.cos(latRad);
  const A = Math.cos(latRad) * (lngRad - lng0);

  // Meridional arc
  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256) * latRad -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 * e2 * e2) / 1024) *
        Math.sin(2 * latRad) +
      ((15 * e2 * e2) / 256 + (45 * e2 * e2 * e2) / 1024) *
        Math.sin(4 * latRad) -
      ((35 * e2 * e2 * e2) / 3072) * Math.sin(6 * latRad));

  const easting =
    k0 *
      N *
      (A +
        ((1 - T + C) * A * A * A) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A * A * A * A * A) / 120) +
    500000;

  let northing =
    k0 *
    (M +
      N *
        Math.tan(latRad) *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * A * A * A * A) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ep2) *
            A *
            A *
            A *
            A *
            A *
            A) /
            720));

  // Adjust for southern hemisphere
  if (hemisphere === 'S') {
    northing += 10000000;
  }

  return {
    easting,
    northing,
    zone,
    hemisphere,
  };
}

/**
 * Convert UTM coordinates to pixel coordinates within a tile
 *
 * For bottom-up COGs (standard GeoTIFF format):
 * - Pixel (0,0) is at the SW corner (minX, minY)
 * - X increases eastward (right)
 * - Y increases northward (up in geographic space, but stored as increasing row numbers)
 *
 * @param utm - UTM coordinates
 * @param tileOriginX - X origin of the tile in UTM (west edge, minX)
 * @param tileOriginY - Y origin of the tile in UTM (south edge, minY)
 * @param pixelSize - Size of each pixel in meters (typically 10m)
 * @returns Pixel coordinates in the COG's native storage order
 */
export function utmToPixel(
  utm: UTMCoord,
  tileOriginX: number,
  tileOriginY: number,
  pixelSize: number = CONFIG.PIXEL_SIZE
): PixelCoord {
  // X increases to the right (east)
  const x = Math.floor((utm.easting - tileOriginX) / pixelSize);
  // Y increases northward in UTM, and in bottom-up COGs row 0 is at minY (south)
  // So Y pixel = (northing - minY) / pixelSize
  const y = Math.floor((utm.northing - tileOriginY) / pixelSize);

  return { x, y };
}

/**
 * Convert lat/lng directly to pixel coordinates within a tile
 */
export function latLngToPixel(
  lat: number,
  lng: number,
  tileOriginX: number,
  tileOriginY: number,
  pixelSize: number = CONFIG.PIXEL_SIZE
): PixelCoord {
  const utm = latLngToUTM(lat, lng);
  return utmToPixel(utm, tileOriginX, tileOriginY, pixelSize);
}

/**
 * Calculate pixel window for a bounding box within a tile
 *
 * For bottom-up COGs:
 * - Row 0 is at the south (minLat)
 * - Column 0 is at the west (minLng)
 *
 * @param bbox - Bounding box in lat/lng
 * @param tileOriginX - X origin of tile in UTM (west edge, minX)
 * @param tileOriginY - Y origin of tile in UTM (south edge, minY)
 * @param pixelSize - Pixel size in meters
 * @returns Window as [x, y, width, height] where (x,y) is the SW corner pixel
 */
export function bboxToPixelWindow(
  bbox: BoundingBox,
  tileOriginX: number,
  tileOriginY: number,
  pixelSize: number = CONFIG.PIXEL_SIZE
): [number, number, number, number] {
  // SW corner of bbox (minLat, minLng) - this gives the smallest pixel coords
  const sw = latLngToPixel(
    bbox.minLat,
    bbox.minLng,
    tileOriginX,
    tileOriginY,
    pixelSize
  );
  // NE corner of bbox (maxLat, maxLng) - this gives the largest pixel coords
  const ne = latLngToPixel(
    bbox.maxLat,
    bbox.maxLng,
    tileOriginX,
    tileOriginY,
    pixelSize
  );

  // Window starts at SW corner (smallest x and y)
  const x = sw.x;
  const y = sw.y;
  const width = ne.x - sw.x + 1;
  const height = ne.y - sw.y + 1;

  return [x, y, width, height];
}

/**
 * Parse UTM zone string (e.g., "10N" or "10S") into zone number and hemisphere
 */
export function parseUTMZone(zoneStr: string): { zone: number; hemisphere: 'N' | 'S' } {
  const match = zoneStr.match(/^(\d+)([NS])$/i);
  if (!match) {
    throw new Error(`Invalid UTM zone format: ${zoneStr}`);
  }
  return {
    zone: parseInt(match[1], 10),
    hemisphere: match[2].toUpperCase() as 'N' | 'S',
  };
}
