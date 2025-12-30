import type { BoundingBox } from '../types'

/**
 * Ray-casting algorithm for point-in-polygon test
 */
function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1]
    const xj = polygon[j][0], yj = polygon[j][1]

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Create a boolean mask for pixels inside a polygon
 * Returns null if no polygon is defined (all pixels valid)
 */
export function createPolygonMask(
  bounds: BoundingBox,
  width: number,
  height: number
): boolean[] | null {
  if (!bounds.polygon) return null

  const mask = new Array<boolean>(width * height)
  const lngStep = (bounds.maxLng - bounds.minLng) / width
  const latStep = (bounds.maxLat - bounds.minLat) / height

  for (let y = 0; y < height; y++) {
    // Note: y=0 is top (maxLat), y=height-1 is bottom (minLat)
    const lat = bounds.maxLat - (y + 0.5) * latStep
    for (let x = 0; x < width; x++) {
      const lng = bounds.minLng + (x + 0.5) * lngStep
      mask[y * width + x] = pointInPolygon(lng, lat, bounds.polygon)
    }
  }

  return mask
}
