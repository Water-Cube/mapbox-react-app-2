import { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

const Markers = ({ map }) => {
  useEffect(() => {
    if (!map) return; // If the map is not initialized, do nothing

    // Fetch markers from aoi.geojson
    fetch('/data/aoi.geojson')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load GeoJSON file');
        }
        return response.json();
      })
      .then((geojson) => {
        geojson.features.forEach((feature) => {
          const coordinates = feature.geometry.coordinates;
          const { name, location } = feature.properties;

          const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <h4>${name}</h4>
            <p>${location}</p>
          `);

          new mapboxgl.Marker()
            .setLngLat(coordinates)
            .setPopup(popup)
            .addTo(map);
        });
      })
      .catch((error) => console.error('Error loading GeoJSON:', error));

  }, [map]);

  return null; // No visible JSX output
};

export default Markers;
