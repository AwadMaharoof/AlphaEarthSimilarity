# AlphaEarth Similarity Search

A browser-based tool for finding visually similar features in satellite imagery using [AlphaEarth embeddings](https://arxiv.org/abs/2507.22291) — all client-side, no backend required.

## How It Works

1. **Select Area** — Click to place a 1/2/4km square, or draw a custom polygon
2. **Load Embeddings** — Fetch 64-dimensional satellite embeddings for the region
3. **Pick Reference** — Click any pixel to use as the similarity reference
4. **Explore Results** — Adjust threshold and opacity to explore similar features

## Data Source

Embeddings loaded from [TGE Labs AlphaEarth dataset](https://source.coop/tge-labs/aef) on Source Cooperative:
- 64-dimensional embeddings per 10m pixel
- Cloud-Optimized GeoTIFF (COG) format
- Global coverage, 2018-2024
- Tile index via GeoParquet for fast lookup

## Similarity Algorithm

Uses dot product on unit-normalized vectors, following [Google Earth Engine's recommended approach](https://developers.google.com/earth-engine/tutorials/community/satellite-embedding-05-similarity-search):
- Vectors are normalized to unit length after dequantization
- Dot product equals cosine similarity for unit vectors
- Scores near 1.0 indicate high similarity

## Tech Stack

- **Build**: Vite
- **UI**: React + TypeScript
- **Map**: MapLibre GL JS + Carto basemap
- **Drawing**: @mapbox/mapbox-gl-draw
- **COG Loading**: geotiff.js + fzstd (ZSTD decompression)
- **Visualization**: deck.gl BitmapLayer

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## References

- [AlphaEarth Paper](https://arxiv.org/abs/2507.22291)
- [Source Cooperative Dataset](https://source.coop/tge-labs/aef)
- [Google Earth Engine Similarity Tutorial](https://developers.google.com/earth-engine/tutorials/community/satellite-embedding-05-similarity-search)
- [Satellite Embedding Introduction](https://developers.google.com/earth-engine/tutorials/community/satellite-embedding-01-introduction)

## License

MIT
