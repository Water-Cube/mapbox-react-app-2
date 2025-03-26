#!/usr/bin/env python3
from mapbox import Uploader
import os

def main():
    # Your Mapbox access token
    access_token = "sk.eyJ1Ijoic2ltb252cCIsImEiOiJjbTZzczM1Y3kwOHJrMmpzZjFlNXUwOWNtIn0.449LWA2pOpadwlMduS9TJA"
    
    # Your Mapbox username and desired tileset ID
    username = "simonvp"
    tileset_id = "Skysat321updated160220250859321"
    
    # Full path to the GeoTIFF file
    file_path = "/Users/mountainmedia/Downloads/Skysat67cm_16022025_0859_321.tif"
    
    # Combine username and tileset ID
    tileset = f"{username}.{tileset_id}"
    
    # Check if the file exists
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} does not exist.")
        return
    
    # Get file size
    file_size = os.path.getsize(file_path) / (1024 * 1024)  # Convert bytes to MB
    print(f"File: {file_path}, Size: {file_size:.2f} MB")
    
    # Initialize the uploader
    uploader = Uploader(access_token=access_token)
    
    # Upload the file
    print("Starting upload...")
    try:
        print(f"Uploading {file_path} to Mapbox...")
        response = uploader.upload(file_path, tileset)
        if response.status_code == 201:
            print(f"Upload successful for {file_path}!")
            print(response.json())
        else:
            print(f"Upload failed with status code: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"An error occurred during upload: {e}")

if __name__ == "__main__":
    main()
