export const CONFIG = {
  // Basemap
  BASEMAP_URL: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',

  // COG Index (GeoParquet for efficient loading)
  COG_INDEX_URL: 'https://data.source.coop/tge-labs/aef/v1/annual/aef_index.parquet',

  // Constraints
  MAX_BOX_SIZE_KM: 20,
  EMBEDDING_BANDS: 64,

  // Pixel resolution in meters (AlphaEarth embeddings are 10m resolution)
  PIXEL_SIZE: 10,

  // Default map view (Singapore - covered by 2024 data)
  DEFAULT_CENTER: [103.84, 1.28] as [number, number],
  DEFAULT_ZOOM: 10,

  // Year filter
  TARGET_YEAR: '2024',
} as const;
