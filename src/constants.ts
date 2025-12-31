export const CONFIG = {
  // Basemap
  BASEMAP_URL: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',

  // COG Index (pre-filtered to 2024 for faster loading)
  COG_INDEX_URL: 'https://awadmaharoof.github.io/AlphaEarthSimilarity/aef_index_2024.parquet',

  // Constraints
  MAX_BOX_SIZE_KM: 20,
  EMBEDDING_BANDS: 64,

  // Pixel resolution in meters (AlphaEarth embeddings are 10m resolution)
  PIXEL_SIZE: 10,

  // Default map view (Singapore - covered by 2024 data)
  DEFAULT_CENTER: [103.8, 1.35] as [number, number],
  DEFAULT_ZOOM: 11,

  // Year filter
  TARGET_YEAR: '2024',
} as const;
