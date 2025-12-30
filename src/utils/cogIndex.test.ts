import { describe, it, expect } from 'vitest';
import { load } from '@loaders.gl/core';
import { ParquetLoader } from '@loaders.gl/parquet';
import { findTileForBoundingBox, clearTileCache } from './cogIndex';

const COG_INDEX_URL = 'https://data.source.coop/tge-labs/aef/v1/annual/aef_index.parquet';

describe('COG Index Parquet', () => {
  it('should parse parquet schema correctly', async () => {
    const data = await load(COG_INDEX_URL, ParquetLoader, {
      parquet: {
        shape: 'object-row-table',
      },
    });

    const rows = Array.isArray(data) ? data : (data as { data: unknown[] }).data;
    expect(rows.length).toBeGreaterThan(0);

    const firstRow = rows[0] as Record<string, unknown>;
    console.log('Schema keys:', Object.keys(firstRow));
    console.log('First row:', firstRow);

    // Check expected fields exist
    expect(firstRow).toHaveProperty('crs');
    expect(firstRow).toHaveProperty('year');
    expect(firstRow).toHaveProperty('utm_zone');

    // Check path field - may be string or Uint8Array depending on parquet loader
    expect(firstRow).toHaveProperty('path');
    const pathValue = firstRow.path;
    const pathString = typeof pathValue === 'string'
      ? pathValue
      : new TextDecoder().decode(pathValue as Uint8Array);
    console.log('Decoded path:', pathString);
    expect(pathString).toContain('s3://');

    // Check bounds are parseable
    const wgs84West = parseFloat(firstRow.wgs84_west as string);
    const wgs84East = parseFloat(firstRow.wgs84_east as string);
    const wgs84South = parseFloat(firstRow.wgs84_south as string);
    const wgs84North = parseFloat(firstRow.wgs84_north as string);

    console.log('Bounds:', { wgs84West, wgs84East, wgs84South, wgs84North });

    expect(wgs84West).not.toBeNaN();
    expect(wgs84East).not.toBeNaN();
    expect(wgs84South).not.toBeNaN();
    expect(wgs84North).not.toBeNaN();
  }, 120000);

  it('should find 2024 tiles', async () => {
    const data = await load(COG_INDEX_URL, ParquetLoader, {
      parquet: {
        shape: 'object-row-table',
      },
    });

    const rows = Array.isArray(data) ? data : (data as { data: unknown[] }).data;

    const tiles2024 = (rows as Record<string, unknown>[]).filter(
      row => row.year === '2024' || row.year === 2024
    );

    console.log(`Found ${tiles2024.length} tiles for 2024 out of ${rows.length} total`);
    expect(tiles2024.length).toBeGreaterThan(0);

    // Check a sample tile from San Francisco area (UTM zone 10N)
    const sfTile = tiles2024.find(row => row.utm_zone === '10N');
    if (sfTile) {
      console.log('Sample SF tile:', sfTile);
      const pathString = new TextDecoder().decode(sfTile.path as Uint8Array);
      console.log('SF tile path:', pathString);
    }
  }, 120000);

  it('should find tile for covered area', async () => {
    clearTileCache();

    // Use a location that IS covered based on candidates:
    // { west: -122.07, east: -121.12, south: 37.73, north: 38.48 }
    const coveredBbox = {
      minLng: -121.8,
      minLat: 38.0,
      maxLng: -121.7,
      maxLat: 38.1,
    };

    const result = await findTileForBoundingBox(coveredBbox);

    console.log('Tile lookup result:', result);

    if (!result) {
      // Debug: check what zones and lat ranges are available
      const data = await load(COG_INDEX_URL, ParquetLoader, {
        parquet: { shape: 'object-row-table' },
      });
      const rows = Array.isArray(data) ? data : (data as { data: unknown[] }).data;
      const tiles2024 = (rows as Record<string, unknown>[]).filter(
        row => row.year === '2024'
      );

      // Find tiles in zone 10N
      const zone10N = tiles2024.filter(row => row.utm_zone === '10N');
      console.log(`Zone 10N tiles: ${zone10N.length}`);

      if (zone10N.length > 0) {
        // Find tiles that could contain SF (lat ~37.75)
        const sfCandidates = zone10N.filter(t => {
          const south = parseFloat(t.wgs84_south as string);
          const north = parseFloat(t.wgs84_north as string);
          return south <= 37.75 && north >= 37.75;
        });
        console.log(`Tiles containing lat 37.75: ${sfCandidates.length}`);

        if (sfCandidates.length > 0) {
          // Show their longitude ranges
          console.log('Candidates:', sfCandidates.slice(0, 5).map(t => ({
            west: parseFloat(t.wgs84_west as string),
            east: parseFloat(t.wgs84_east as string),
            south: parseFloat(t.wgs84_south as string),
            north: parseFloat(t.wgs84_north as string),
          })));
        }

        // Show overall longitude range for zone 10N
        const lngs = zone10N.map(t => ({
          west: parseFloat(t.wgs84_west as string),
          east: parseFloat(t.wgs84_east as string),
        }));
        const minLng = Math.min(...lngs.map(l => l.west));
        const maxLng = Math.max(...lngs.map(l => l.east));
        console.log(`Zone 10N longitude coverage: ${minLng} to ${maxLng}`);
        console.log(`Looking for longitude: -122.45 (SF)`);
      }

      // List all available zones
      const zones = [...new Set(tiles2024.map(t => t.utm_zone))].sort();
      console.log('Available UTM zones:', zones);
    }

    expect(result).not.toBeNull();
  }, 120000);
});
