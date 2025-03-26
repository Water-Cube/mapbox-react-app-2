#!/usr/bin/env python3
import subprocess
import sys
import numpy as np
import rasterio
import os
import tempfile

# ====================================================
# Configuration - Edit these to match your requirements
# ====================================================
INPUT_FILE = "/Users/mountainmedia/Downloads/Pleaides30cm_17022025_1115.tiff"  
OUTPUT_FILE = "/Users/mountainmedia/Downloads/Pleaides30cm_17022025_1115.tiff"  
BANDS = "3,2,1"  # Set the band order you want for the output (e.g., "3,2,1" for an RGB composite)
CUMULATIVE_CUT_MIN = 1.0  # Lower percentile (e.g., 1.0 for 1%)
CUMULATIVE_CUT_MAX = 99.0  # Upper percentile (e.g., 98.0 for 98%)
# ====================================================

def print_file_info(input_file):
    """Print basic metadata about the input GeoTIFF."""
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
    """
    Compute the valid (non-background) window of the input image.
    
    Logic:
      - If the file has 4 or more bands, try to use band 4 as an alpha channel.
        If band 4 is uniformly opaque (e.g. all 255), then it’s not useful for cropping.
      - In that case (or if the file has fewer than 4 bands), use the sum of the specified
        bands (from band_list) to compute a mask (non-zero indicates valid data).
    
    Returns (col_off, row_off, width, height).
    """
    with rasterio.open(input_file) as src:
        use_rgb_mask = False
        if src.count >= 4:
            # Read band 4 (alpha channel)
            alpha = src.read(4)
            # Check if the alpha channel is uniformly opaque (assume opaque value is 255)
            if np.all(alpha == 255):
                print("Alpha channel is uniformly opaque. Falling back to using RGB bands for cropping.")
                use_rgb_mask = True
            else:
                print("Using alpha channel (band 4) for cropping.")
                mask = (alpha > 0).astype(np.uint8)
        else:
            use_rgb_mask = True
        
        if use_rgb_mask:
            # Read the bands specified in band_list (e.g., 3,2,1)
            arr = src.read(band_list)  # shape: (num_bands, height, width)
            # Create a mask: valid if the sum across bands is greater than 0.
            mask = (np.sum(arr, axis=0) > 0).astype(np.uint8)
        
        # Find indices of valid pixels
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
    """
    Compute the percentile-based min/max values for each band in band_list.
    
    Args:
        input_file: Path to the input GeoTIFF.
        band_list: List of band indices to process (e.g., [3, 2, 1]).
        min_percentile: Lower percentile (e.g., 1.0 for 1%).
        max_percentile: Upper percentile (e.g., 98.0 for 98%).
    
    Returns:
        List of tuples [(src_min, src_max), ...] for each band.
    """
    with rasterio.open(input_file) as src:
        ranges = []
        for band in band_list:
            # Read the band data
            data = src.read(band)
            # Mask out nodata values if they exist
            if src.nodata is not None:
                data = data[data != src.nodata]
            # Flatten the array and compute percentiles
            if data.size > 0:
                src_min = np.percentile(data, min_percentile)
                src_max = np.percentile(data, max_percentile)
            else:
                src_min, src_max = 0, 255  # Fallback in case of no valid data
            ranges.append((src_min, src_max))
            print(f"Band {band}: Scaling range from {src_min} to {src_max} (percentiles {min_percentile} to {max_percentile})")
        return ranges

def scale_band(data, src_min, src_max, dst_min=0, dst_max=255):
    """
    Scale the band data from [src_min, src_max] to [dst_min, dst_max].
    
    Args:
        data: Numpy array of band data.
        src_min: Source minimum value (e.g., 1st percentile).
        src_max: Source maximum value (e.g., 99th percentile).
        dst_min: Destination minimum value (default: 0).
        dst_max: Destination maximum value (default: 255).
    
    Returns:
        Scaled numpy array as uint8.
    """
    # Clip the data to the source range
    data = np.clip(data, src_min, src_max)
    # Scale to the destination range
    scaled = (data - src_min) * (dst_max - dst_min) / (src_max - src_min) + dst_min
    # Convert to uint8
    return scaled.astype(np.uint8)

def main():
    # Print input file metadata
    print_file_info(INPUT_FILE)
    
    # Parse and validate the bands list
    try:
        band_list = [int(b.strip()) for b in BANDS.split(",")]
    except ValueError:
        sys.exit("Error: BANDS should be a comma-separated list of integers, e.g., '3,2,1'.")
    
    with rasterio.open(INPUT_FILE) as src:
        if max(band_list) > src.count:
            sys.exit(f"Error: The input file only has {src.count} band(s), but band {max(band_list)} was requested.")
    
    # Compute the valid-data window based on alpha (if available) or RGB bands.
    col_off, row_off, crop_width, crop_height = compute_valid_window(INPUT_FILE, band_list)
    
    # Compute percentile-based scaling ranges for each band
    scale_ranges = compute_percentile_ranges(INPUT_FILE, band_list, CUMULATIVE_CUT_MIN, CUMULATIVE_CUT_MAX)
    
    # Step 1: Use gdal_translate to select bands and crop, but without scaling
    with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as temp_file:
        temp_output = temp_file.name
    
    cmd_step1 = [
        "gdal_translate",
        INPUT_FILE,
        temp_output,
        "-of", "GTiff",  # Use GTiff for the intermediate file
        "-srcwin", str(col_off), str(row_off), str(crop_width), str(crop_height)
    ]
    
    # Append a -b flag for each band in the desired order
    for band in band_list:
        cmd_step1.extend(["-b", str(band)])
    
    print("Running Step 1 command (band selection and cropping):")
    print(" ".join(cmd_step1))
    print("---------------------------------------------------")
    
    try:
        subprocess.run(cmd_step1, check=True)
    except subprocess.CalledProcessError as e:
        sys.exit(f"Error during Step 1 (band selection and cropping): {e}")
    
    # Step 2: Use rasterio to read the cropped file, apply scaling, and write the result
    with rasterio.open(temp_output) as src:
        # Read the cropped data
        data = src.read()  # Shape: (num_bands, height, width)
        profile = src.profile.copy()
        
        # Update the profile for the output
        profile.update(
            dtype=rasterio.uint8,
            count=len(band_list),
            compress='lzw',
            driver='COG'
        )
        
        # Scale each band
        scaled_data = np.zeros_like(data, dtype=np.uint8)
        for band_idx, (src_min, src_max) in enumerate(scale_ranges):
            scaled_data[band_idx] = scale_band(data[band_idx], src_min, src_max)
        
        # Write the scaled data to the output file
        with rasterio.open(OUTPUT_FILE, 'w', **profile) as dst:
            dst.write(scaled_data)
    
    # Clean up the temporary file
    os.remove(temp_output)
    
    print("Conversion complete. Output file created at:", OUTPUT_FILE)

if __name__ == "__main__":
    main()