import { describe, it, expect } from 'vitest';
import { fromUrl, addDecoder, BaseDecoder } from 'geotiff';
import { decompress as zstdDecompress } from 'fzstd';
import { flipVertical } from './flipVertical';
import { dequantize } from './dequantize';

const TEST_COG_URL = 'https://data.source.coop/tge-labs/aef/v1/annual/2024/10N/xcyo46pot2fg6a61t-0000008192-0000000000.tiff';

// ZSTD magic bytes
const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

function isZstdCompressed(buffer: ArrayBuffer): boolean {
  const view = new Uint8Array(buffer);
  return ZSTD_MAGIC.every((byte, i) => view[i] === byte);
}

// Custom decoder for compression code 50000
class ZstdDecoder extends BaseDecoder {
  async decode(_fileDirectory: unknown, buffer: ArrayBuffer) {
    if (isZstdCompressed(buffer)) {
      const compressed = new Uint8Array(buffer);
      const decompressed = zstdDecompress(compressed);
      const dataBuffer = new ArrayBuffer(decompressed.byteLength);
      new Uint8Array(dataBuffer).set(decompressed);
      return dataBuffer;
    }
    return buffer;
  }
}

// Register ZSTD decoder
let decoderRegistered = false;
function ensureDecoderRegistered() {
  if (decoderRegistered) return;
  decoderRegistered = true;
  addDecoder(50000, () => Promise.resolve(ZstdDecoder));
}

describe('COG Pipeline', () => {
  describe('Raw COG Structure', () => {
    it('should have expected tile structure', async () => {
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

  describe('Data Type Conversion', () => {
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

  describe('Embedding Processing', () => {
    it('should produce valid embeddings with variance across pixels', async () => {
      ensureDecoderRegistered();

      const tiff = await fromUrl(TEST_COG_URL);
      const image = await tiff.getImage();

      // Read a small window (20x20 pixels = 400 pixels)
      const windowX = 100;
      const windowY = 100;
      const windowWidth = 20;
      const windowHeight = 20;

      const rasterData = await image.readRasters({
        window: [windowX, windowY, windowX + windowWidth, windowY + windowHeight],
        interleave: true,
      });

      // Convert to Int8Array
      const rasterArray = rasterData as unknown as Uint8Array;
      const rawData = new Int8Array(rasterArray.buffer, rasterArray.byteOffset, rasterArray.length);

      // Flip vertical (COGs are bottom-up)
      const flippedData = flipVertical(rawData, windowWidth, windowHeight, 64);

      // Dequantize
      const { embeddings, mask } = dequantize(flippedData, windowWidth, windowHeight);

      console.log('Total pixels:', windowWidth * windowHeight);
      console.log('Valid pixels:', mask.filter(Boolean).length);

      // Extract a few sample embeddings from different pixels
      const bands = 64;
      const sampleIndices = [0, 10, 100, 200, 399].filter(i => i < windowWidth * windowHeight && mask[i]);

      console.log('\nSample embeddings (first 8 bands):');
      for (const pixelIdx of sampleIndices) {
        const baseIdx = pixelIdx * bands;
        const sample = Array.from(embeddings.slice(baseIdx, baseIdx + 8)).map(v => v.toFixed(4));
        console.log(`  Pixel ${pixelIdx}: [${sample.join(', ')}]`);
      }

      // Calculate variance for first band across all valid pixels
      const firstBandValues: number[] = [];
      for (let i = 0; i < windowWidth * windowHeight; i++) {
        if (mask[i]) {
          firstBandValues.push(embeddings[i * bands]);
        }
      }

      const mean = firstBandValues.reduce((a, b) => a + b, 0) / firstBandValues.length;
      const variance = firstBandValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / firstBandValues.length;

      console.log(`\nFirst band stats:`);
      console.log(`  Mean: ${mean.toFixed(6)}`);
      console.log(`  Variance: ${variance.toFixed(6)}`);
      console.log(`  Std Dev: ${Math.sqrt(variance).toFixed(6)}`);
      console.log(`  Min: ${Math.min(...firstBandValues).toFixed(6)}`);
      console.log(`  Max: ${Math.max(...firstBandValues).toFixed(6)}`);

      // Note: AlphaEarth embeddings in homogeneous regions have very low variance
      // This is expected behavior - adjacent pixels in uniform land cover have similar embeddings
      // The test verifies that we ARE getting varied data (not all zeros or all same value)
      expect(variance).toBeGreaterThan(0);
      expect(Math.max(...firstBandValues)).not.toBe(Math.min(...firstBandValues));
    }, 60000);
  });

  describe('Similarity Calculation', () => {
    it('should produce valid cosine similarities', async () => {
      ensureDecoderRegistered();

      const tiff = await fromUrl(TEST_COG_URL);
      const image = await tiff.getImage();

      // Read a larger window to ensure diversity
      const windowWidth = 50;
      const windowHeight = 50;

      const rasterData = await image.readRasters({
        window: [200, 200, 200 + windowWidth, 200 + windowHeight],
        interleave: true,
      });

      const rasterArray = rasterData as unknown as Uint8Array;
      const rawData = new Int8Array(rasterArray.buffer, rasterArray.byteOffset, rasterArray.length);
      const flippedData = flipVertical(rawData, windowWidth, windowHeight, 64);
      const { embeddings, mask } = dequantize(flippedData, windowWidth, windowHeight);

      const bands = 64;
      const numPixels = windowWidth * windowHeight;

      // Find first valid pixel as reference
      let refIdx = -1;
      for (let i = 0; i < numPixels; i++) {
        if (mask[i]) {
          refIdx = i;
          break;
        }
      }
      expect(refIdx).toBeGreaterThanOrEqual(0);

      // Extract and normalize reference vector
      const refVector = new Float32Array(bands);
      let refMag = 0;
      for (let b = 0; b < bands; b++) {
        refVector[b] = embeddings[refIdx * bands + b];
        refMag += refVector[b] * refVector[b];
      }
      refMag = Math.sqrt(refMag);
      for (let b = 0; b < bands; b++) {
        refVector[b] /= refMag;
      }

      // Calculate cosine similarity for all valid pixels
      const similarities: number[] = [];
      for (let i = 0; i < numPixels; i++) {
        if (!mask[i]) continue;

        let dotProduct = 0;
        let mag = 0;
        for (let b = 0; b < bands; b++) {
          const val = embeddings[i * bands + b];
          dotProduct += val * refVector[b];
          mag += val * val;
        }
        mag = Math.sqrt(mag);
        const sim = mag > 0 ? dotProduct / mag : 0;
        similarities.push(sim);
      }

      const sorted = [...similarities].sort((a, b) => a - b);
      console.log('\nCosine similarity distribution:');
      console.log(`  Min: ${sorted[0].toFixed(4)}`);
      console.log(`  10th percentile: ${sorted[Math.floor(sorted.length * 0.1)].toFixed(4)}`);
      console.log(`  Median: ${sorted[Math.floor(sorted.length * 0.5)].toFixed(4)}`);
      console.log(`  90th percentile: ${sorted[Math.floor(sorted.length * 0.9)].toFixed(4)}`);
      console.log(`  Max: ${sorted[sorted.length - 1].toFixed(4)}`);

      // Note: In homogeneous regions, all similarities will be very high (0.99+)
      // This is expected for AlphaEarth embeddings in uniform land cover
      const range = sorted[sorted.length - 1] - sorted[0];
      console.log(`  Range: ${range.toFixed(4)}`);

      // Verify we get valid cosine similarity values
      expect(sorted[0]).toBeGreaterThanOrEqual(-1);
      expect(sorted[sorted.length - 1]).toBeLessThanOrEqual(1);
      expect(sorted[sorted.length - 1]).toBeCloseTo(1, 2); // Reference pixel should have ~1.0 similarity
      expect(range).toBeGreaterThan(0);
    }, 60000);
  });
});
