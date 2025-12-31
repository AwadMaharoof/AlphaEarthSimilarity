import type { BoundingBox } from '../types';

/**
 * GeoTIFF Tag IDs
 * @see https://docs.ogc.org/is/19-008r4/19-008r4.html (OGC GeoTIFF Standard)
 */
const TAG = {
  ImageWidth: 256,
  ImageLength: 257,
  BitsPerSample: 258,
  Compression: 259,
  PhotometricInterpretation: 262,
  StripOffsets: 273,
  SamplesPerPixel: 277,
  RowsPerStrip: 278,
  StripByteCounts: 279,
  PlanarConfiguration: 284,
  SampleFormat: 339,
  // GeoTIFF tags
  ModelPixelScaleTag: 33550,
  ModelTiepointTag: 33922,
  GeoKeyDirectoryTag: 34735,
} as const;

/**
 * GeoKey IDs for EPSG:4326
 * @see https://docs.ogc.org/is/19-008r4/19-008r4.html#_requirements_class_geokeydirectorytag
 */
const GEOKEY = {
  GTModelTypeGeoKey: 1024,
  GTRasterTypeGeoKey: 1025,
  GeographicTypeGeoKey: 2048,
} as const;

/**
 * Write a 16-bit unsigned integer (little-endian)
 */
function writeUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

/**
 * Write a 32-bit unsigned integer (little-endian)
 */
function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

/**
 * Write a 64-bit float (little-endian)
 */
function writeFloat64(view: DataView, offset: number, value: number): void {
  view.setFloat64(offset, value, true);
}

/**
 * Download Float32 similarity scores as a georeferenced GeoTIFF.
 *
 * The output is a single-band Float32 GeoTIFF with:
 * - CRS: EPSG:4326 (WGS84 geographic coordinates)
 * - Pixel values: similarity scores (0-1, or -1 for masked)
 */
export function downloadGeoTiff(
  scores: Float32Array,
  width: number,
  height: number,
  bounds: BoundingBox,
  filename: string = 'similarity.tif'
): void {
  // Calculate pixel size in degrees
  const pixelScaleX = (bounds.maxLng - bounds.minLng) / width;
  const pixelScaleY = (bounds.maxLat - bounds.minLat) / height;

  // Image data size
  const imageDataSize = width * height * 4; // Float32 = 4 bytes

  // GeoTIFF double arrays
  const pixelScale = [pixelScaleX, pixelScaleY, 0]; // 3 doubles = 24 bytes
  const tiepoint = [0, 0, 0, bounds.minLng, bounds.maxLat, 0]; // 6 doubles = 48 bytes

  // GeoKey directory: [version, revision, minor, numKeys, ...keys]
  // Each key: [keyId, tiffTagLocation, count, value]
  const geoKeys = [
    1, 1, 0, 3, // version 1.1.0, 3 keys
    GEOKEY.GTModelTypeGeoKey, 0, 1, 2, // ModelTypeGeographic
    GEOKEY.GTRasterTypeGeoKey, 0, 1, 1, // RasterPixelIsArea
    GEOKEY.GeographicTypeGeoKey, 0, 1, 4326, // EPSG:4326
  ]; // 16 shorts = 32 bytes

  // Calculate offsets
  // Header: 8 bytes
  // IFD offset pointer at byte 4
  const headerSize = 8;

  // IFD structure:
  // - 2 bytes: number of entries
  // - N * 12 bytes: directory entries
  // - 4 bytes: next IFD offset (0)
  const numTags = 14;
  const ifdSize = 2 + numTags * 12 + 4;

  // Extended data (values that don't fit in 4 bytes)
  const extDataOffset = headerSize + ifdSize;
  const pixelScaleSize = 24; // 3 doubles
  const tiepointSize = 48; // 6 doubles
  const geoKeysSize = 32; // 16 shorts
  const extDataSize = pixelScaleSize + tiepointSize + geoKeysSize;

  // Image data offset (must be 4-byte aligned for Float32Array)
  const unalignedOffset = extDataOffset + extDataSize;
  const imageDataOffset = Math.ceil(unalignedOffset / 4) * 4;

  // Total file size
  const totalSize = imageDataOffset + imageDataSize;

  // Create buffer
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  // Write TIFF header
  // Byte order: little-endian ("II")
  uint8[0] = 0x49; // 'I'
  uint8[1] = 0x49; // 'I'
  // Magic number: 42
  writeUint16(view, 2, 42);
  // Offset to first IFD
  writeUint32(view, 4, headerSize);

  // Write IFD
  let ifdOffset = headerSize;
  writeUint16(view, ifdOffset, numTags);
  ifdOffset += 2;

  // Helper to write an IFD entry
  let extOffset = extDataOffset;

  function writeTag(tag: number, type: number, count: number, value: number | number[]): void {
    writeUint16(view, ifdOffset, tag);
    writeUint16(view, ifdOffset + 2, type);
    writeUint32(view, ifdOffset + 4, count);

    // Type sizes: 1=BYTE, 2=ASCII, 3=SHORT, 4=LONG, 5=RATIONAL, 12=DOUBLE
    const typeSizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 12: 8 };
    const valueSize = count * (typeSizes[type] || 4);

    if (valueSize <= 4) {
      // Value fits in the offset field
      if (type === 3) { // SHORT
        if (Array.isArray(value)) {
          for (let i = 0; i < count && i < 2; i++) {
            writeUint16(view, ifdOffset + 8 + i * 2, value[i]);
          }
        } else {
          writeUint16(view, ifdOffset + 8, value);
        }
      } else { // LONG or other
        writeUint32(view, ifdOffset + 8, Array.isArray(value) ? value[0] : value);
      }
    } else {
      // Write offset to extended data
      writeUint32(view, ifdOffset + 8, extOffset);

      // Write extended data
      if (type === 12) { // DOUBLE
        const values = value as number[];
        for (let i = 0; i < count; i++) {
          writeFloat64(view, extOffset + i * 8, values[i]);
        }
      } else if (type === 3) { // SHORT
        const values = value as number[];
        for (let i = 0; i < count; i++) {
          writeUint16(view, extOffset + i * 2, values[i]);
        }
      }
      extOffset += valueSize;
    }

    ifdOffset += 12;
  }

  // Write tags (must be in ascending order by tag ID)
  writeTag(TAG.ImageWidth, 4, 1, width);
  writeTag(TAG.ImageLength, 4, 1, height);
  writeTag(TAG.BitsPerSample, 3, 1, 32);
  writeTag(TAG.Compression, 3, 1, 1); // No compression
  writeTag(TAG.PhotometricInterpretation, 3, 1, 1); // BlackIsZero
  writeTag(TAG.StripOffsets, 4, 1, imageDataOffset);
  writeTag(TAG.SamplesPerPixel, 3, 1, 1);
  writeTag(TAG.RowsPerStrip, 4, 1, height);
  writeTag(TAG.StripByteCounts, 4, 1, imageDataSize);
  writeTag(TAG.PlanarConfiguration, 3, 1, 1);
  writeTag(TAG.SampleFormat, 3, 1, 3); // IEEE floating point
  writeTag(TAG.ModelPixelScaleTag, 12, 3, pixelScale);
  writeTag(TAG.ModelTiepointTag, 12, 6, tiepoint);
  writeTag(TAG.GeoKeyDirectoryTag, 3, 16, geoKeys);

  // Next IFD offset (0 = no more IFDs)
  writeUint32(view, ifdOffset, 0);

  // Write image data directly
  // scores array already has row 0 = north (maxLat) after flipVertical in useCOGLoader
  const imageData = new Float32Array(buffer, imageDataOffset, width * height);
  imageData.set(scores);

  // Download
  const blob = new Blob([buffer], { type: 'image/tiff' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
