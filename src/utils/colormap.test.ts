import { describe, it, expect } from 'vitest';
import { viridis, scoresToRGBA } from './colormap';

describe('Colormap', () => {
  describe('viridis', () => {
    it('should return purple at 0', () => {
      const [r, g, b] = viridis(0);
      expect(r).toBe(68);
      expect(g).toBe(1);
      expect(b).toBe(84);
    });

    it('should return yellow at 1', () => {
      const [r, g, b] = viridis(1);
      expect(r).toBe(253);
      expect(g).toBe(231);
      expect(b).toBe(37);
    });

    it('should return teal at 0.5', () => {
      const [r, g, b] = viridis(0.5);
      expect(r).toBe(33);
      expect(g).toBe(145);
      expect(b).toBe(140);
    });

    it('should clamp values outside [0, 1]', () => {
      expect(viridis(-0.5)).toEqual(viridis(0));
      expect(viridis(1.5)).toEqual(viridis(1));
    });
  });

  describe('scoresToRGBA with dynamic scaling', () => {
    it('should handle narrow score ranges (like 0.998-1.0)', () => {
      // Simulate scores from a homogeneous region
      const width = 3;
      const height = 3;
      const scores = new Float32Array([
        0.998, 0.999, 1.0,
        0.9985, 0.9995, 0.999,
        0.998, 0.9988, 0.9992
      ]);

      const rgba = scoresToRGBA(scores, width, height, 0.5, false, 1.0);

      // Extract unique colors (ignoring alpha)
      const colors = new Set<string>();
      for (let i = 0; i < scores.length; i++) {
        const r = rgba[i * 4];
        const g = rgba[i * 4 + 1];
        const b = rgba[i * 4 + 2];
        colors.add(`${r},${g},${b}`);
      }

      // With dynamic scaling, we should see multiple different colors
      // even though the score range is only 0.002
      expect(colors.size).toBeGreaterThan(1);
      console.log(`Narrow range (0.998-1.0) produced ${colors.size} distinct colors`);
    });

    it('should map min score to purple and max score to yellow', () => {
      const scores = new Float32Array([0.5, 0.75, 1.0]);
      const rgba = scoresToRGBA(scores, 3, 1, 0.0, false, 1.0);

      // First pixel (min score 0.5) should be purple
      const purple = viridis(0);
      expect(rgba[0]).toBe(purple[0]);
      expect(rgba[1]).toBe(purple[1]);
      expect(rgba[2]).toBe(purple[2]);

      // Last pixel (max score 1.0) should be yellow
      const yellow = viridis(1);
      expect(rgba[8]).toBe(yellow[0]);
      expect(rgba[9]).toBe(yellow[1]);
      expect(rgba[10]).toBe(yellow[2]);
    });

    it('should treat negative scores as masked (transparent)', () => {
      const scores = new Float32Array([0.5, -1, 1.0]);
      const rgba = scoresToRGBA(scores, 3, 1, 0.0, false, 1.0);

      // Middle pixel is masked - should be transparent
      expect(rgba[4]).toBe(0); // R
      expect(rgba[5]).toBe(0); // G
      expect(rgba[6]).toBe(0); // B
      expect(rgba[7]).toBe(0); // A (transparent)

      // First and last should be opaque
      expect(rgba[3]).toBe(255); // A
      expect(rgba[11]).toBe(255); // A
    });

    it('should apply binary mask correctly with dynamic threshold', () => {
      // Scores range from 0.9 to 1.0
      const scores = new Float32Array([0.9, 0.95, 1.0]);
      // Threshold of 0.5 means show values >= 0.95 (midpoint of range)
      const rgba = scoresToRGBA(scores, 3, 1, 0.5, true, 1.0);

      // First pixel (0.9) should be transparent (below threshold)
      expect(rgba[3]).toBe(0);

      // Second pixel (0.95) should be opaque (at threshold)
      expect(rgba[7]).toBe(255);

      // Third pixel (1.0) should be opaque (above threshold)
      expect(rgba[11]).toBe(255);
    });

    it('should handle all identical scores', () => {
      const scores = new Float32Array([0.999, 0.999, 0.999, 0.999]);
      const rgba = scoresToRGBA(scores, 2, 2, 0.0, false, 1.0);

      // Should not crash and should produce valid RGBA
      for (let i = 0; i < 4; i++) {
        expect(rgba[i * 4 + 3]).toBe(255); // All should be opaque
      }
    });
  });
});
