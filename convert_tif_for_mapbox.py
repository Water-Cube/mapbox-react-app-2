#!/usr/bin/env python3
import subprocess
import sys
import numpy as np
import rasterio
import os
import tempfile

# ====================================================
# Configuration
# ====================================================
INPUT_FILE = "/Users/mountainmedia/Downloads/Skysat67cm_16022025_0859.tif"  
OUTPUT_FILE = "/Users/mountainmedia/Downloads/Skysat67cm_16022025_0859_321.tif"  
BANDS = "3,2,1"  # RGB composite
CUMULATIVE_CUT_MIN = 0.5  # Reduced to avoid excessive clipping
CUMULATIVE_CUT_MAX = 99.5  # Small increase to retain highlights
# ====================================================

def print_file_info(input_file):
    with rasterio.open(input_file) as src:
        print("Input file:", input_file)
        print("Driver:", src.driver)
        print("Width:", src.width, "Height:", src.height)
        print("Number of bands:", src.count)
        print("CRS:", src.crs)
        print("Transform:", src.transform)
        print("Nodata value:", src.nodata)
        print("---------------------------------------------------")

def compute_valid_window(input_file, band_list):
    with rasterio.open(input_file) as src:
        use_rgb_mask = False
        if src.count >= 4:
            alpha = src.read(4)
            if np.all(alpha == 255):
                print("Alpha channel is uniformly opaque. Using RGB mask instead.")
                use_rgb_mask = True
            else:
                print("Using alpha channel (band 4) for cropping.")
                mask = (alpha > 0).astype(np.uint8)
        else:
            use_rgb_mask = True
        
        if use_rgb_mask:
            arr = src.read(band_list)
            threshold = np.percentile(arr, 0.1)  # Avoid removing dark but valid pixels
            mask = (np.sum(arr, axis=0) > threshold).astype(np.uint8)
        
        rows, cols = np.where(mask > 0)
        if rows.size == 0 or cols.size == 0:
            sys.exit("Error: No valid data found to crop.")
        row_min, row_max = int(rows.min()), int(rows.max())
        col_min, col_max = int(cols.min()), int(cols.max())
        crop_width = col_max - col_min + 1
        crop_height = row_max - row_min + 1
        print(f"Cropping to valid window: col_off={col_min}, row_off={row_min}, width={crop_width}, height={crop_height}")
        return col_min, row_min, crop_width, crop_height

def compute_percentile_ranges(input_file, band_list, min_percentile, max_percentile):
    with rasterio.open(input_file) as src:
        ranges = []
        for band in band_list:
            data = src.read(band)
            if src.nodata is not None:
                data = data[data != src.nodata]
            if data.size > 0:
                src_min = np.percentile(data, min_percentile)
                src_max = np.percentile(data, max_percentile)
            else:
                src_min, src_max = 0, 255
            ranges.append((src_min, src_max))
            print(f"Band {band}: Scaling range from {src_min} to {src_max} (percentiles {min_percentile} to {max_percentile})")
        return ranges

def scale_band(data, src_min, src_max, dst_min=0, dst_max=255):
    data = np.clip(data, src_min, src_max)
    scaled = (data - src_min) * (dst_max - dst_min) / (src_max - src_min) + dst_min
    return scaled.astype(np.uint8)

def main():
    print_file_info(INPUT_FILE)
    
    try:
        band_list = [int(b.strip()) for b in BANDS.split(",")]
    except ValueError:
        sys.exit("Error: BANDS should be a comma-separated list of integers, e.g., '3,2,1'.")

    with rasterio.open(INPUT_FILE) as src:
        if max(band_list) > src.count:
            sys.exit(f"Error: The input file only has {src.count} band(s), but band {max(band_list)} was requested.")

    col_off, row_off, crop_width, crop_height = compute_valid_window(INPUT_FILE, band_list)
    scale_ranges = compute_percentile_ranges(INPUT_FILE, band_list, CUMULATIVE_CUT_MIN, CUMULATIVE_CUT_MAX)

    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as temp_file:
        temp_output = temp_file.name

    cmd_step1 = [
        "gdal_translate",
        INPUT_FILE,
        temp_output,
        "-of", "GTiff",
        "-srcwin", str(col_off), str(row_off), str(crop_width), str(crop_height)
    ]
    
    for band in band_list:
        cmd_step1.extend(["-b", str(band)])

    print("Running Step 1 command (band selection and cropping):")
    print(" ".join(cmd_step1))
    print("---------------------------------------------------")

    try:
        subprocess.run(cmd_step1, check=True)
    except subprocess.CalledProcessError as e:
        sys.exit(f"Error during Step 1: {e}")

    with rasterio.open(temp_output) as src:
        data = src.read()
        profile = src.profile.copy()
        profile.update(dtype=rasterio.uint8, count=len(band_list), compress='lzw', driver='COG')

        scaled_data = np.zeros_like(data, dtype=np.uint8)
        for band_idx, (src_min, src_max) in enumerate(scale_ranges):
            scaled_data[band_idx] = scale_band(data[band_idx], src_min, src_max)

        with rasterio.open(OUTPUT_FILE, 'w', **profile) as dst:
            dst.write(scaled_data)

    os.remove(temp_output)
    
    print("Conversion complete. Output file created at:", OUTPUT_FILE)

if __name__ == "__main__":
    main()
