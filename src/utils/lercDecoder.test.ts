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
});
