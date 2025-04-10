import mapboxgl from 'mapbox-gl';

/**
 * Takes a screenshot of a vessel's location on the map
 * @param {Object} options - Configuration options
 * @param {Object} options.map - The main Mapbox map instance
 * @param {Object} options.vessel - The vessel data object
 * @param {number} options.zoomLevel - Zoom level for the screenshot (default: 15)
 * @param {number} options.width - Width of the screenshot in pixels (default: 800)
 * @param {number} options.height - Height of the screenshot in pixels (default: 600)
 * @param {boolean} options.showMarker - Whether to show a marker on the vessel (default: true)
 * @param {boolean} options.showCircle - Whether to show a circle around the vessel (default: true)
 * @param {boolean} options.showLabel - Whether to show a label with vessel info (default: true)
 * @param {string} options.circleColor - Color of the circle (default: '#ff0000')
 * @param {number} options.circleRadius - Radius of the circle in pixels (default: 20)
 * @param {boolean} options.download - Whether to download the screenshot (default: true)
 * @returns {Promise} - Resolves with the image data URL
 */
export const captureVesselScreenshot = ({
  map,
  vessel,
  zoomLevel = 15,
  width = 800,
  height = 600,
  showMarker = true,
  showCircle = true,
  showLabel = true,
  circleColor = '#ff0000',
  circleRadius = 20,
  download = true
}) => {
  return new Promise((resolve, reject) => {
    if (!map || !vessel || !vessel.geometry || !vessel.geometry.coordinates) {
      reject(new Error('Cannot capture screenshot: map or vessel data not available'));
      return;
    }

    // Get the vessel's coordinates
    const [lng, lat] = vessel.geometry.coordinates;
    const vesselName = vessel.properties.name || 'Unknown Vessel';
    const vesselMmsi = vessel.properties.mmsi;
    
    // Create a temporary div for the screenshot
    const container = document.createElement('div');
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    
    // Create a temporary map for the screenshot
    const tempMap = new mapboxgl.Map({
      container: container,
      style: map.getStyle(),
      center: [lng, lat],
      zoom: zoomLevel,
      interactive: false,
      attributionControl: false
    });
    
    // Wait for the map to load
    tempMap.on('load', () => {
      // Add the vessel marker if requested
      if (showMarker) {
        const marker = new mapboxgl.Marker()
          .setLngLat([lng, lat])
          .addTo(tempMap);
      }
      
      // Add a circle around the vessel if requested
      if (showCircle) {
        tempMap.addSource('vessel-location', {
          type: 'geojson',
          data: {
            type: 'Point',
            coordinates: [lng, lat]
          }
        });
        
        tempMap.addLayer({
          id: 'vessel-circle',
          type: 'circle',
          source: 'vessel-location',
          paint: {
            'circle-radius': circleRadius,
            'circle-color': circleColor,
            'circle-opacity': 0.5,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });
      }
      
      // Add vessel information as a label if requested
      if (showLabel) {
        tempMap.addSource('vessel-label', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {
              name: `${vesselName} (${vesselMmsi})`
            },
            geometry: {
              type: 'Point',
              coordinates: [lng, lat]
            }
          }
        });
        
        tempMap.addLayer({
          id: 'vessel-label',
          type: 'symbol',
          source: 'vessel-label',
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 14,
            'text-anchor': 'top',
            'text-offset': [0, 1]
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 2
          }
        });
      }
      
      // Wait a moment for everything to render
      setTimeout(() => {
        // Get the canvas element
        const canvas = tempMap.getCanvas();
        
        // Convert canvas to data URL
        const dataUrl = canvas.toDataURL('image/png');
        
        if (download) {
          // Create download link
          const link = document.createElement('a');
          link.download = `vessel_${vesselMmsi}_${new Date().toISOString().split('T')[0]}.png`;
          link.href = dataUrl;
          link.click();
        }
        
        // Clean up
        tempMap.remove();
        document.body.removeChild(container);
        
        // Resolve with the data URL
        resolve(dataUrl);
      }, 500);
    });
  });
};

/**
 * Predefined zoom levels for different vessel views
 */
export const ZOOM_LEVELS = {
  VERY_CLOSE: 18, // Extremely close view of the vessel
  CLOSE: 15,      // Close view of the vessel
  MEDIUM: 12,     // Medium view showing the vessel and immediate surroundings
  FAR: 9,         // Far view showing the vessel and a larger area
  VERY_FAR: 6     // Very far view showing the vessel and a large area
}; 