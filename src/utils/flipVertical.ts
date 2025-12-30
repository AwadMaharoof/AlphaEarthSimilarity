/**
 * Flip raster data vertically (COGs are stored bottom-up)
 * This converts from bottom-left origin to top-left origin
 *
 * @param data - The raster data (can be any typed array)
 * @param width - Width of the raster in pixels
 * @param height - Height of the raster in pixels
 * @param bands - Number of bands per pixel
 * @returns New array with flipped data
 */
export function flipVertical<T extends Int8Array | Float32Array>(
  data: T,
  width: number,
  height: number,
  bands: number
): T {
  const result = new (data.constructor as new (length: number) => T)(data.length);
  const rowSize = width * bands;

  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y;
    const srcOffset = srcRow * rowSize;
    const dstOffset = y * rowSize;

    for (let i = 0; i < rowSize; i++) {
      result[dstOffset + i] = data[srcOffset + i];
    }
  }

  return result;
}

