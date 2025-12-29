import { describe, it, expect } from 'vitest';
import { fromUrl } from 'geotiff';
import { decompress as zstdDecompress } from 'fzstd';

const TEST_COG_URL = 'https://data.source.coop/tge-labs/aef/v1/annual/2024/10N/xcyo46pot2fg6a61t-0000008192-0000000000.tiff';

// ZSTD magic bytes
const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

function isZstdCompressed(buffer: ArrayBuffer): boolean {
  const view = new Uint8Array(buffer);
  return ZSTD_MAGIC.every((byte, i) => view[i] === byte);
}

describe('COG Decoder', () => {
  it('should fetch and inspect COG tile structure', async () => {
    const tiff = await fromUrl(TEST_COG_URL);
    const image = await tiff.getImage();

    const fileDirectory = image.fileDirectory;

    expect(fileDirectory.Compression).toBe(50000);
    expect(fileDirectory.SamplesPerPixel).toBe(64);
    expect(fileDirectory.TileWidth).toBe(1024);
    expect(fileDirectory.TileLength).toBe(1024);
  }, 30000);

  it('should decompress ZSTD tile data to raw pixels', async () => {
    const tiff = await fromUrl(TEST_COG_URL);
    const image = await tiff.getImage();

    const tileOffsets = image.fileDirectory.TileOffsets;
    const tileByteCounts = image.fileDirectory.TileByteCounts;

    // Fetch raw tile data directly
    const response = await fetch(TEST_COG_URL, {
      headers: {
        'Range': `bytes=${tileOffsets![0]}-${tileOffsets![0] + tileByteCounts![0] - 1}`
      }
    });

    const rawBuffer = await response.arrayBuffer();
    expect(isZstdCompressed(rawBuffer)).toBe(true);

    // Decompress ZSTD
    const compressed = new Uint8Array(rawBuffer);
    const decompressed = zstdDecompress(compressed);

    // Should be 1024 * 1024 = 1MB (one tile, one band, 8-bit)
    expect(decompressed.byteLength).toBe(1024 * 1024);

    // Interpret as signed int8 (quantized embeddings)
    const pixels = new Int8Array(decompressed.buffer);

    // Check value range
    let min = pixels[0], max = pixels[0];
    for (let i = 1; i < pixels.length; i++) {
      if (pixels[i] < min) min = pixels[i];
      if (pixels[i] > max) max = pixels[i];
    }

    // -128 is nodata, valid values are in [-127, 127]
    expect(min).toBe(-128);
    expect(max).toBeLessThanOrEqual(127);
  }, 60000);

  it('should correctly convert Uint8Array to Int8Array for signed interpretation', () => {
    // This test verifies the fix for the validPixels: 0 bug
    // geotiff returns Uint8Array, but embeddings are signed Int8

    // Simulate what geotiff returns (unsigned bytes)
    const uint8Data = new Uint8Array([128, 255, 0, 127, 1]);
    // 128 unsigned = -128 signed (nodata)
    // 255 unsigned = -1 signed
    // 0 unsigned = 0 signed
    // 127 unsigned = 127 signed
    // 1 unsigned = 1 signed

    // Wrong: just type casting (uint8Data as unknown as Int8Array) doesn't
    // reinterpret bytes - at runtime values would still be unsigned

    // Correct: create Int8Array view over the same buffer
    const int8Data = new Int8Array(uint8Data.buffer, uint8Data.byteOffset, uint8Data.length);

    expect(int8Data[0]).toBe(-128); // nodata value
    expect(int8Data[1]).toBe(-1);
    expect(int8Data[2]).toBe(0);
    expect(int8Data[3]).toBe(127);
    expect(int8Data[4]).toBe(1);

    // Verify nodata detection works with signed interpretation
    const NODATA = -128;
    const hasNodata = Array.from(int8Data).some(v => v === NODATA);
    expect(hasNodata).toBe(true);
  });
});
