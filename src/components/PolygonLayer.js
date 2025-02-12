import mapboxgl from 'mapbox-gl';

export const addPolygonToMap = async (map, polygonCoordinates, userId, shouldFitBounds = true) => {
  if (!map || !polygonCoordinates || polygonCoordinates[0].length < 4) return;

  const polygonId = 'polygon-layer';

  // Remove existing sources/layers to avoid duplicates
  if (map.getLayer(polygonId)) map.removeLayer(polygonId);
  if (map.getLayer(`${polygonId}-outline`)) map.removeLayer(`${polygonId}-outline`);
  if (map.getSource(polygonId)) map.removeSource(polygonId);

  // 1) Polygon GeoJSON source
  map.addSource(polygonId, {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [polygonCoordinates[0]],
      },
    },
  });

  // 2) Filled polygon layer (invisible fill)
  map.addLayer({
    id: polygonId,
    type: 'fill',
    source: polygonId,
    paint: {
      'fill-color': '#2ECC71',
      'fill-opacity': 0.0,
    },
  });

  // 3) Polygon outline layer
  map.addLayer({
    id: `${polygonId}-outline`,
    type: 'line',
    source: polygonId,
    paint: {
      'line-color': '#1D8348',
      'line-width': 2,
    },
  });

  try {
    // Fetch user tilesets JSON file
    const response = await fetch('/data/user-tilesets.json');
    const userData = await response.json();

    if (!userData[userId] || !userData[userId].tilesets || userData[userId].tilesets.length === 0) {
      console.error(`No tilesets found for user: ${userId}`);
      return;
    }

    // Iterate over all tilesets under the user
    userData[userId].tilesets.forEach((tileset) => {
      const tilesetId = tileset.id; // e.g., 'area1', 'area2', etc.
      const tilesetUrl = `mapbox://simonvp.${tilesetId}`; // Construct the Mapbox URL

      // Remove existing source/layer if it exists
      if (map.getLayer(tilesetId)) map.removeLayer(tilesetId);
      if (map.getSource(tilesetId)) map.removeSource(tilesetId);

      // Add raster source for the tileset
      map.addSource(tilesetId, {
        type: 'raster',
        url: tilesetUrl,
        tileSize: 256,
      });

      // Add raster layer for the tileset
      map.addLayer({
        id: tilesetId,
        type: 'raster',
        source: tilesetId,
        paint: {
          'raster-opacity': 1,
        },
      });
    });

    if (shouldFitBounds) {
      fitToBounds(map, polygonCoordinates[0]);
    }

  } catch (error) {
    console.error('Error loading user tilesets:', error);
  }
};

// Helper to fit the map to the bounding box of the polygon
function fitToBounds(map, coords) {
  const bounds = new mapboxgl.LngLatBounds();
  coords.forEach((coord) => bounds.extend(coord));
  map.fitBounds(bounds, { padding: 20 });
}
