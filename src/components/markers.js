import { useEffect, useState } from 'react';
// eslint-disable-next-line no-unused-vars
import mapboxgl from 'mapbox-gl';

const Markers = ({ map: mapProp, userId, showControls = false, showPaths, togglePaths }) => {
  const [aisData, setAisData] = useState(null);
  const [selectedTileset, setSelectedTileset] = useState(null);
  const [localMap, setLocalMap] = useState(null);

  // Color palette for different vessel paths
  const PATH_COLORS = [
    '#1f77b4',  // Blue
    '#ff7f0e',  // Orange
    '#2ca02c',  // Green
    '#d62728',  // Red
    '#9467bd',  // Purple
    '#8c564b',  // Brown
    '#e377c2',  // Pink
    '#7f7f7f',  // Gray
    '#bcbd22',  // Olive
    '#17becf'   // Cyan
  ];

  // Sync localMap with mapProp
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mapProp && mapProp !== localMap) {
      setLocalMap(mapProp);
    }
  }, [mapProp]);

  // Load AIS data and arrow image
  useEffect(() => {
    if (!localMap || !userId) return;

    const loadAisData = async () => {
      if (userId !== 'femern@email.com') return;

      try {
        const fileListResponse = await fetch('/data/ais_data/file_list.json');
        if (!fileListResponse.ok) throw new Error(`Failed to load file list: ${fileListResponse.status}`);
        const fileList = await fileListResponse.json();

        const fetchPromises = fileList.map(async (file) => {
          const response = await fetch(`/data/ais_data/${file}`);
          if (!response.ok) return [];
          const geojson = await response.json();
          return geojson.features;
        });

        const allFeaturesArrays = await Promise.all(fetchPromises);
        const allFeatures = allFeaturesArrays.flat();

        const combinedGeojson = {
          type: 'FeatureCollection',
          features: allFeatures.map((feature) => ({
            ...feature,
            properties: {
              ...feature.properties,
              cog: parseFloat(feature.properties.cog) || 0,
            },
          })),
        };
        setAisData(combinedGeojson);
      } catch (error) {
        console.error('Error loading AIS data:', error);
      }
    };

    const loadArrowImage = () => {
      if (!localMap.hasImage('arrow')) {
        localMap.loadImage('/images/arrow.png', (error, image) => {
          if (error) console.error('Error loading arrow image:', error);
          else localMap.addImage('arrow', image);
        });
      }
    };

    if (localMap.isStyleLoaded()) {
      loadAisData();
      loadArrowImage();
    } else {
      localMap.on('load', () => {
        loadAisData();
        loadArrowImage();
      });
    }

    return () => {
      if (localMap) {
        ['ais-ships-layer', 'ais-paths-layer'].forEach(layer => {
          if (localMap.getLayer(layer)) localMap.removeLayer(layer);
        });
        ['ais-ships', 'ais-paths'].forEach(source => {
          if (localMap.getSource(source)) localMap.removeSource(source);
        });
      }
    };
  }, [localMap, userId]);

  // Handle tileset selection
  useEffect(() => {
    if (!localMap) return;
    const handleTilesetSelect = (event) => setSelectedTileset(event.detail);
    window.addEventListener('tilesetSelected', handleTilesetSelect);
    return () => window.removeEventListener('tilesetSelected', handleTilesetSelect);
  }, [localMap]);

  // Update AIS markers and paths
  useEffect(() => {
    if (!localMap || !aisData || userId !== 'femern@email.com') {
      return;
    }

    if (!selectedTileset?.date) {
      // Remove layers and sources if no tileset is selected
      ['ais-ships-layer', 'ais-paths-layer'].forEach(layer => {
        if (localMap.getLayer(layer)) localMap.removeLayer(layer);
      });
      ['ais-ships', 'ais-paths'].forEach(source => {
        if (localMap.getSource(source)) localMap.removeSource(source);
      });
      
      // Dispatch event with empty active vessels
      window.dispatchEvent(new CustomEvent('aisMarkersUpdated', { 
        detail: { 
          active: [], 
          all: aisData.features 
        } 
      }));
      
      return;
    }

    const tilesetTime = new Date(selectedTileset.date);
    if (isNaN(tilesetTime.getTime())) return;

    const shipTracks = {};

    // Group all tracks by MMSI
    aisData.features.forEach((feature) => {
      const mmsi = feature.properties.mmsi;
      
      // Flexible timestamp parsing
      let timestamp;
      try {
        // Try parsing different timestamp formats
        timestamp = new Date(feature.properties.timestamp);
        
        // Fallback parsing for specific format (DD/MM/YYYY HH:MM:SS)
        if (isNaN(timestamp.getTime()) && typeof feature.properties.timestamp === 'string') {
          const [datePart, timePart] = feature.properties.timestamp.split(' ');
          const [day, month, year] = datePart.split('/');
          const [hours, minutes, seconds] = timePart.split(':');
          timestamp = new Date(year, month - 1, day, hours, minutes, seconds);
        }
      } catch (error) {
        console.error('Timestamp parsing error:', error);
        return;
      }

      if (isNaN(timestamp.getTime())) {
        console.error('Invalid timestamp:', feature.properties.timestamp);
        return;
      }

      if (!shipTracks[mmsi]) {
        shipTracks[mmsi] = [];
      }
      
      shipTracks[mmsi].push({ 
        feature, 
        timestamp 
      });
    });

    // Sort tracks chronologically for each ship
    Object.keys(shipTracks).forEach(mmsi => {
      shipTracks[mmsi].sort((a, b) => a.timestamp - b.timestamp);
    });

    // Find the latest position for each ship at or before the tileset time
    const shipPositionsAtTime = {};
    Object.entries(shipTracks).forEach(([mmsi, track]) => {
      const latestPositionBeforeTime = track
        .filter(entry => entry.timestamp <= tilesetTime)
        .pop(); // Get the last entry before or at tileset time

      if (latestPositionBeforeTime) {
        shipPositionsAtTime[mmsi] = latestPositionBeforeTime;
      }
    });

    // Generate full paths for each ship
    const pathFeatures = Object.entries(shipPositionsAtTime).map(([mmsi, currentPosition], index) => {
      const track = shipTracks[mmsi];
      
      // Filter coordinates up to and including the current position
      const pathCoords = track
        .filter(entry => entry.timestamp <= currentPosition.timestamp)
        .map(entry => entry.feature.geometry.coordinates);

      return {
        type: 'Feature',
        properties: { 
          mmsi,
          startTimestamp: track[0].timestamp.toISOString(),
          endTimestamp: currentPosition.timestamp.toISOString(),
          color: PATH_COLORS[index % PATH_COLORS.length] // Cycle through colors
        },
        geometry: { 
          type: 'LineString', 
          coordinates: pathCoords 
        }
      };
    });

    const filteredFeatures = Object.values(shipPositionsAtTime).map(entry => entry.feature);
    
    const filteredGeojson = { 
      type: 'FeatureCollection', 
      features: filteredFeatures 
    };

    const pathsGeojson = { 
      type: 'FeatureCollection', 
      features: pathFeatures 
    };

    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('aisMarkersUpdated', { 
      detail: { 
        active: filteredFeatures, 
        all: aisData.features 
      } 
    }));

    // If no active vessels, remove layers and sources
    if (filteredFeatures.length === 0) {
      ['ais-ships-layer', 'ais-paths-layer'].forEach(layer => {
        if (localMap.getLayer(layer)) localMap.removeLayer(layer);
      });
      ['ais-ships', 'ais-paths'].forEach(source => {
        if (localMap.getSource(source)) localMap.removeSource(source);
      });
      return;
    }

    // Map rendering logic
    // Ships layer
    if (!localMap.getSource('ais-ships')) {
      localMap.addSource('ais-ships', { type: 'geojson', data: filteredGeojson });
      localMap.addLayer({
        id: 'ais-ships-layer',
        type: 'symbol',
        source: 'ais-ships',
        layout: {
          'icon-image': 'arrow',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.05, 14, 0.1, 18, 0.1],
          'icon-rotate': ['get', 'cog'],
          'icon-allow-overlap': true,
          'icon-rotation-alignment': 'map',
        },
        paint: { 'icon-opacity': 1 },
      });
      
      const handleMarkerClick = (e) => {
        const feature = e.features[0];
        window.dispatchEvent(new CustomEvent('vesselSelected', { detail: feature }));
      };

      const handleMouseEnter = () => localMap.getCanvas().style.cursor = 'pointer';
      const handleMouseLeave = () => localMap.getCanvas().style.cursor = '';

      localMap.on('click', 'ais-ships-layer', handleMarkerClick);
      localMap.on('mouseenter', 'ais-ships-layer', handleMouseEnter);
      localMap.on('mouseleave', 'ais-ships-layer', handleMouseLeave);
    } else {
      localMap.getSource('ais-ships').setData(filteredGeojson);
    }

    // Paths layer
    if (!localMap.getSource('ais-paths')) {
      localMap.addSource('ais-paths', { type: 'geojson', data: pathsGeojson });
      localMap.addLayer({
        id: 'ais-paths-layer',
        type: 'line',
        source: 'ais-paths',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
          'visibility': showPaths ? 'visible' : 'none'
        },
        paint: {
          'line-color': ['get', 'color'], // Use color from feature properties
          'line-width': 2,
          'line-opacity': 0.7
        }
      });
    } else {
      localMap.getSource('ais-paths').setData(pathsGeojson);
      localMap.setLayoutProperty('ais-paths-layer', 'visibility', showPaths ? 'visible' : 'none');
    }

  }, [localMap, aisData, selectedTileset, userId, showPaths]);

  return showControls ? (
    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1 }}>
      <button
        onClick={togglePaths}
        style={{
          padding: '5px 10px',
          backgroundColor: showPaths ? '#ff4444' : '#4444ff',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer'
        }}
      >
        {showPaths ? 'Hide' : 'Show'} Vessel Paths
      </button>
    </div>
  ) : null;
};

export default Markers;