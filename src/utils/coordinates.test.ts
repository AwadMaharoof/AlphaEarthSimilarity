import { describe, it, expect } from 'vitest';
import {
  latLngToUTM,
  utmToPixel,
  latLngToPixel,
  bboxToPixelWindow,
  getUTMZone,
  getHemisphere,
} from './coordinates';

describe('Coordinate Utilities', () => {
  describe('getUTMZone', () => {
    it('should return correct UTM zone for longitude', () => {
      expect(getUTMZone(-122.4)).toBe(10); // San Francisco
      expect(getUTMZone(103.8)).toBe(48);  // Singapore
      expect(getUTMZone(0)).toBe(31);      // Greenwich
      expect(getUTMZone(-180)).toBe(1);    // Date line west
      expect(getUTMZone(179)).toBe(60);    // Date line east
    });
  });

  describe('getHemisphere', () => {
    it('should return N for positive latitude', () => {
      expect(getHemisphere(37.7)).toBe('N');
      expect(getHemisphere(1.3)).toBe('N');
      expect(getHemisphere(0)).toBe('N');
    });

    it('should return S for negative latitude', () => {
      expect(getHemisphere(-33.9)).toBe('S');
      expect(getHemisphere(-0.1)).toBe('S');
    });
  });

  describe('latLngToUTM', () => {
    it('should convert Singapore coordinates correctly', () => {
      // Singapore: ~1.3°N, ~103.8°E, UTM zone 48N
      const utm = latLngToUTM(1.3, 103.8);
      expect(utm.zone).toBe(48);
      expect(utm.hemisphere).toBe('N');
      // Easting should be around 500000 (central meridian)
      expect(utm.easting).toBeGreaterThan(300000);
      expect(utm.easting).toBeLessThan(700000);
      // Northing should be positive and relatively small (near equator)
      expect(utm.northing).toBeGreaterThan(100000);
      expect(utm.northing).toBeLessThan(200000);
    });

    it('should handle southern hemisphere', () => {
      // Sydney: ~-33.9°S, ~151.2°E
      const utm = latLngToUTM(-33.9, 151.2);
      expect(utm.hemisphere).toBe('S');
      // Southern hemisphere adds 10,000,000 to northing
      expect(utm.northing).toBeGreaterThan(6000000);
    });
  });

  describe('utmToPixel (SW origin for bottom-up COGs)', () => {
    // Simulated tile with SW corner at (500000, 4000000) UTM
    const tileOriginX = 500000; // West edge (minX)
    const tileOriginY = 4000000; // South edge (minY)
    const pixelSize = 10;

    it('should return (0,0) for point at SW corner', () => {
      const utm = { easting: 500000, northing: 4000000, zone: 10, hemisphere: 'N' as const };
      const pixel = utmToPixel(utm, tileOriginX, tileOriginY, pixelSize);
      expect(pixel.x).toBe(0);
      expect(pixel.y).toBe(0);
    });

    it('should increase X eastward', () => {
      const utm = { easting: 500100, northing: 4000000, zone: 10, hemisphere: 'N' as const };
      const pixel = utmToPixel(utm, tileOriginX, tileOriginY, pixelSize);
      expect(pixel.x).toBe(10); // 100m / 10m = 10 pixels
      expect(pixel.y).toBe(0);
    });

    it('should increase Y northward (bottom-up COG convention)', () => {
      const utm = { easting: 500000, northing: 4000100, zone: 10, hemisphere: 'N' as const };
      const pixel = utmToPixel(utm, tileOriginX, tileOriginY, pixelSize);
      expect(pixel.x).toBe(0);
      expect(pixel.y).toBe(10); // 100m north = 10 pixels up in row number
    });

    it('should handle NE corner correctly', () => {
      // Point 1km east and 1km north of origin
      const utm = { easting: 501000, northing: 4001000, zone: 10, hemisphere: 'N' as const };
      const pixel = utmToPixel(utm, tileOriginX, tileOriginY, pixelSize);
      expect(pixel.x).toBe(100);
      expect(pixel.y).toBe(100);
    });
  });

  describe('bboxToPixelWindow', () => {
    it('should calculate correct window for bbox', () => {
      // Create a bbox that spans 100m x 100m
      // We need to convert back from UTM to lat/lng for the test
      // For simplicity, use approximate values

      // Bbox covering pixels (10,10) to (19,19) - a 10x10 pixel area
      // In UTM: from (500100, 4000100) to (500190, 4000190)
      // Need corresponding lat/lng... this is tricky without reverse conversion

      // Instead, test with known Singapore coordinates
      const bbox = {
        minLng: 103.85,
        minLat: 1.30,
        maxLng: 103.86,
        maxLat: 1.31,
      };

      // Get the actual tile origin for Singapore
      const sgOriginX = 500000; // Approximate for zone 48N
      const sgOriginY = 100000; // Approximate for near-equator

      const [, , width, height] = bboxToPixelWindow(bbox, sgOriginX, sgOriginY, 10);

      // Window should have positive dimensions
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);

      // ~0.01 degrees ≈ 1.1km at equator ≈ 110 pixels
      expect(width).toBeGreaterThan(50);
      expect(width).toBeLessThan(200);
      expect(height).toBeGreaterThan(50);
      expect(height).toBeLessThan(200);
    });

    it('should have SW corner as window origin', () => {
      // For bottom-up COGs, the window (x,y) should be the SW corner
      // which has the smallest pixel coordinates
      const bbox = {
        minLng: 103.85,
        minLat: 1.30,
        maxLng: 103.86,
        maxLat: 1.31,
      };

      const sgOriginX = 500000;
      const sgOriginY = 100000;

      const [x, y, width, height] = bboxToPixelWindow(bbox, sgOriginX, sgOriginY, 10);

      // The SW corner (minLat, minLng) should give smaller pixel coords
      // than the NE corner (maxLat, maxLng)
      const swPixel = latLngToPixel(bbox.minLat, bbox.minLng, sgOriginX, sgOriginY, 10);
      const nePixel = latLngToPixel(bbox.maxLat, bbox.maxLng, sgOriginX, sgOriginY, 10);

      expect(x).toBe(swPixel.x);
      expect(y).toBe(swPixel.y);
      expect(nePixel.x).toBeGreaterThan(swPixel.x);
      expect(nePixel.y).toBeGreaterThan(swPixel.y);
      expect(width).toBe(nePixel.x - swPixel.x + 1);
      expect(height).toBe(nePixel.y - swPixel.y + 1);
    });
  });

  describe('Coordinate system consistency', () => {
    it('should maintain correct orientation: south has lower Y than north', () => {
      const originX = 500000;
      const originY = 100000; // South edge of tile

      // Two points at same longitude, different latitudes
      const southPoint = latLngToPixel(1.30, 103.85, originX, originY, 10);
      const northPoint = latLngToPixel(1.31, 103.85, originX, originY, 10);

      // In bottom-up COG, north has higher pixel Y than south
      expect(northPoint.y).toBeGreaterThan(southPoint.y);
      // X should be the same
      expect(northPoint.x).toBe(southPoint.x);
    });

    it('should maintain correct orientation: west has lower X than east', () => {
      const originX = 500000;
      const originY = 100000;

      // Two points at same latitude, different longitudes
      const westPoint = latLngToPixel(1.30, 103.85, originX, originY, 10);
      const eastPoint = latLngToPixel(1.30, 103.86, originX, originY, 10);

      // East has higher pixel X than west
      expect(eastPoint.x).toBeGreaterThan(westPoint.x);
      // Y should be the same
      expect(eastPoint.y).toBe(westPoint.y);
    });
  });
});
