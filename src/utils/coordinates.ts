import { UTMCoord, PixelCoord, BoundingBox } from '../types';

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

  let easting =
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
 * @param utm - UTM coordinates
 * @param tileOriginX - X origin of the tile in UTM (left edge)
 * @param tileOriginY - Y origin of the tile in UTM (top edge, max Y)
 * @param pixelSize - Size of each pixel in meters (typically 10m)
 * @returns Pixel coordinates (0-indexed from top-left)
 */
export function utmToPixel(
  utm: UTMCoord,
  tileOriginX: number,
  tileOriginY: number,
  pixelSize: number = 10
): PixelCoord {
  // X increases to the right
  const x = Math.floor((utm.easting - tileOriginX) / pixelSize);
  // Y increases downward in pixel space (origin is top-left)
  // But UTM northing increases upward, so we invert
  const y = Math.floor((tileOriginY - utm.northing) / pixelSize);

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
  pixelSize: number = 10
): PixelCoord {
  const utm = latLngToUTM(lat, lng);
  return utmToPixel(utm, tileOriginX, tileOriginY, pixelSize);
}

/**
 * Calculate pixel window for a bounding box within a tile
 * @param bbox - Bounding box in lat/lng
 * @param tileOriginX - X origin of tile in UTM
 * @param tileOriginY - Y origin of tile in UTM (top edge)
 * @param pixelSize - Pixel size in meters
 * @returns Window as [x, y, width, height]
 */
export function bboxToPixelWindow(
  bbox: BoundingBox,
  tileOriginX: number,
  tileOriginY: number,
  pixelSize: number = 10
): [number, number, number, number] {
  // Get pixel coordinates for all four corners
  const topLeft = latLngToPixel(
    bbox.maxLat,
    bbox.minLng,
    tileOriginX,
    tileOriginY,
    pixelSize
  );
  const bottomRight = latLngToPixel(
    bbox.minLat,
    bbox.maxLng,
    tileOriginX,
    tileOriginY,
    pixelSize
  );

  const x = topLeft.x;
  const y = topLeft.y;
  const width = bottomRight.x - topLeft.x + 1;
  const height = bottomRight.y - topLeft.y + 1;

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
