#!/usr/bin/env python3
import subprocess
import sys
import numpy as np
import rasterio

# ====================================================
# Configuration - Edit these to match your requirements
# ====================================================
INPUT_FILE = "/Users/mountainmedia/Desktop/Map V1.3 React 6 Feb 1639/mapbox-react-app/public/Spaceline optimeret 50 cm SIWEI 13052024.tif"  
OUTPUT_FILE = "/Users/mountainmedia/Desktop/Map V1.3 React 6 Feb 1639/mapbox-react-app/public/Spaceline optimeret 50 cm SIWEI 13052024_321rgb.tif"  
BANDS = "3,2,1"  # Set the band order you want for the output (e.g., "3,2,1" for an RGB composite)
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
    
    # Build the gdal_translate command.
    # -of COG: Cloud Optimized GeoTIFF output
    # -co COMPRESS=LZW: Use LZW compression
    # -ot Byte: Force output to 8-bit
    # -scale: Auto-scale each band to the 0-255 range (based on computed min/max values)
    # -srcwin: Crop to the valid data window computed above
    cmd = [
        "gdal_translate",
        INPUT_FILE,
        OUTPUT_FILE,
        "-of", "COG",
        "-co", "COMPRESS=LZW",
        "-ot", "Byte",
        "-scale",
        "-srcwin", str(col_off), str(row_off), str(crop_width), str(crop_height)
    ]
    
    # Append a -b flag for each band in the desired order
    for band in band_list:
        cmd.extend(["-b", str(band)])
    
    print("Running command:")
    print(" ".join(cmd))
    print("---------------------------------------------------")
    
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        sys.exit(f"Error during conversion: {e}")
    
    print("Conversion complete. Output file created at:", OUTPUT_FILE)

if __name__ == "__main__":
    main()
