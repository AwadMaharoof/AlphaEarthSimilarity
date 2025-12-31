#!/usr/bin/env python3
"""
Filter the AEF parquet index to only include 2024 data.
This reduces the file size from ~60 MB to ~15-20 MB.

Usage:
    pip install pyarrow requests
    python scripts/filter-parquet.py

Output:
    Creates aef_index_2024.parquet in the current directory.
    Move to public/ for deployment: mv aef_index_2024.parquet public/
"""

import pyarrow.parquet as pq
import pyarrow.compute as pc
import requests
import tempfile
import os

SOURCE_URL = "https://data.source.coop/tge-labs/aef/v1/annual/aef_index.parquet"
OUTPUT_FILE = "aef_index_2024.parquet"
TARGET_YEAR = 2024  # int64 in the parquet file


def download_file(url: str, dest: str) -> None:
    """Download a file with progress indication."""
    print(f"Downloading from {url}...")
    response = requests.get(url, stream=True)
    response.raise_for_status()

    total_size = int(response.headers.get('content-length', 0))
    downloaded = 0

    with open(dest, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
            downloaded += len(chunk)
            if total_size:
                pct = (downloaded / total_size) * 100
                print(f"\rProgress: {pct:.1f}% ({downloaded / 1024 / 1024:.1f} MB)", end="")

    print(f"\nDownloaded {downloaded / 1024 / 1024:.1f} MB")


def main():
    # Download to temp file
    with tempfile.NamedTemporaryFile(suffix='.parquet', delete=False) as tmp:
        tmp_path = tmp.name

    try:
        download_file(SOURCE_URL, tmp_path)

        # Read the parquet file
        print(f"\nReading parquet file...")
        table = pq.read_table(tmp_path)
        original_rows = table.num_rows
        original_size = os.path.getsize(tmp_path)

        print(f"Original: {original_rows:,} rows, {original_size / 1024 / 1024:.1f} MB")

        # Filter to target year
        print(f"\nFiltering to year {TARGET_YEAR}...")
        filtered = table.filter(pc.equal(table.column('year'), TARGET_YEAR))
        filtered_rows = filtered.num_rows

        print(f"Filtered: {filtered_rows:,} rows")

        # Write with zstd compression
        print(f"\nWriting {OUTPUT_FILE} with zstd compression...")
        pq.write_table(
            filtered,
            OUTPUT_FILE,
            compression='zstd',
            compression_level=19  # Max compression
        )

        new_size = os.path.getsize(OUTPUT_FILE)
        reduction = (1 - new_size / original_size) * 100

        print(f"\nResults:")
        print(f"  Original: {original_size / 1024 / 1024:.1f} MB ({original_rows:,} rows)")
        print(f"  Filtered: {new_size / 1024 / 1024:.1f} MB ({filtered_rows:,} rows)")
        print(f"  Reduction: {reduction:.1f}%")
        print(f"\nOutput: {os.path.abspath(OUTPUT_FILE)}")

    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


if __name__ == "__main__":
    main()
