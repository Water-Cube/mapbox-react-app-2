#!/usr/bin/env python3
from mapbox import Uploader

def main():
    # Your Mapbox access token
    access_token = "sk.eyJ1Ijoic2ltb252cCIsImEiOiJjbTZzczM1Y3kwOHJrMmpzZjFlNXUwOWNtIn0.449LWA2pOpadwlMduS9TJA"
    
    # Your Mapbox username and desired tileset ID
    username = "simonvp"
    tileset_id = "SIWEI2024rgb1"  # Change this if you want a different tileset id
    
    # Full path to your GeoTIFF file
    file_path = "/Users/mountainmedia/Desktop/Map V1.3 React 6 Feb 1639/mapbox-react-app/public/Spaceline optimeret 50 cm SIWEI 13052024_321rgb.tif"
    
    # Combine username and tileset id to form the full tileset identifier (e.g., simonvp.convertedtileset)
    tileset = f"{username}.{tileset_id}"
    
    # Initialize the uploader with your access token
    uploader = Uploader(access_token=access_token)
    
    # Start the upload process
    print("Starting upload...")
    response = uploader.upload(file_path, tileset)
    
    # Print the response from Mapbox (status, id, etc.)
    print("Upload response:")
    print(response.json())

if __name__ == "__main__":
    main()
