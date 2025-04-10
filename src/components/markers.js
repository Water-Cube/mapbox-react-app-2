import { useEffect, useState, useMemo, useRef } from 'react';
// eslint-disable-next-line no-unused-vars
import mapboxgl from 'mapbox-gl';

const Markers = ({ map: mapProp, userId, showControls = false, showPaths, togglePaths }) => {
  const [aisData, setAisData] = useState(null);
  const [selectedTileset, setSelectedTileset] = useState(null);
  const [localMap, setLocalMap] = useState(null);
  const [focusedVessel, setFocusedVessel] = useState(null);
  const [pathTime, setPathTime] = useState(null);
  const [visibleMarkers, setVisibleMarkers] = useState(new Set());
  const markersRef = useRef(new Map());

  // Color palette for different vessel paths
  const PATH_COLORS = useMemo(() => [
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
  ], []); // Empty dependency array since colors are static

  // Add zoom threshold constant
  const ZOOM_THRESHOLD = 10; // Only show markers when zoomed in more than this level

  // Sync localMap with mapProp
  useEffect(() => {
    if (mapProp && mapProp !== localMap) {
      setLocalMap(mapProp);
    }
  }, [mapProp, localMap]);

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
  }, [localMap, userId, showPaths, PATH_COLORS]);

  // Handle tileset selection
  useEffect(() => {
    if (!localMap) return;
    const handleTilesetSelect = (event) => setSelectedTileset(event.detail);
    const handleClearAisData = () => {
      // Remove layers and sources if they exist
      ['ais-ships-layer', 'ais-paths-layer'].forEach(layer => {
        if (localMap.getLayer(layer)) localMap.removeLayer(layer);
      });
      ['ais-ships', 'ais-paths'].forEach(source => {
        if (localMap.getSource(source)) localMap.removeSource(source);
      });
      
      // Clear the selected tileset
      setSelectedTileset(null);
      window.dispatchEvent(new CustomEvent('tilesetSelected', { detail: null }));
      
      // Dispatch event with empty active vessels
      window.dispatchEvent(new CustomEvent('aisMarkersUpdated', { 
        detail: { 
          active: [], 
          all: aisData ? aisData.features : [] 
        } 
      }));
    };

    window.addEventListener('tilesetSelected', handleTilesetSelect);
    window.addEventListener('clearAisData', handleClearAisData);
    return () => {
      window.removeEventListener('tilesetSelected', handleTilesetSelect);
      window.removeEventListener('clearAisData', handleClearAisData);
    };
  }, [localMap, aisData]);

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
      
      // Clean up markers properly
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();
      
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

      // Only include tracks from the last 24 hours before the tileset time
      const twentyFourHoursBefore = new Date(tilesetTime.getTime() - 24 * 60 * 60 * 1000);
      if (timestamp >= twentyFourHoursBefore && timestamp <= tilesetTime) {
        if (!shipTracks[mmsi]) {
          shipTracks[mmsi] = [];
        }
        
        shipTracks[mmsi].push({ 
          feature, 
          timestamp 
        });
      }
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

    // Filter path coordinates based on selected time
    const pathFeatures = Object.entries(shipPositionsAtTime).map(([mmsi, currentPosition], index) => {
      const track = shipTracks[mmsi];
      
      // Filter coordinates up to and including the current position
      let pathCoords;
      if (focusedVessel === mmsi && pathTime) {
        // For focused vessel, show path up to selected time
        pathCoords = track
          .filter(entry => entry.timestamp <= pathTime)
          .map(entry => entry.feature.geometry.coordinates);
      } else {
        // For other vessels, show full path up to current position
        pathCoords = track
          .filter(entry => entry.timestamp <= currentPosition.timestamp)
          .map(entry => entry.feature.geometry.coordinates);
      }

      return {
        type: 'Feature',
        properties: { 
          mmsi,
          startTimestamp: track[0].timestamp.toISOString(),
          endTimestamp: currentPosition.timestamp.toISOString(),
          color: PATH_COLORS[index % PATH_COLORS.length]
        },
        geometry: { 
          type: 'LineString', 
          coordinates: pathCoords 
        }
      };
    });

    // Get vessel positions at the selected time
    const vesselPositionsAtTime = {};
    Object.entries(shipTracks).forEach(([mmsi, track]) => {
      if (focusedVessel === mmsi && pathTime) {
        // For focused vessel, get position at selected time
        const positionAtTime = track
          .filter(entry => entry.timestamp <= pathTime)
          .pop();
        if (positionAtTime) {
          vesselPositionsAtTime[mmsi] = positionAtTime;
        }
      } else {
        // For other vessels, get position at tileset time
        const positionAtTime = track
          .filter(entry => entry.timestamp <= tilesetTime)
          .pop();
        if (positionAtTime) {
          vesselPositionsAtTime[mmsi] = positionAtTime;
        }
      }
    });

    const filteredFeatures = Object.values(vesselPositionsAtTime)
      .map(entry => entry.feature)
      .filter(feature => !focusedVessel || feature.properties.mmsi === focusedVessel);
    
    const filteredGeojson = { 
      type: 'FeatureCollection', 
      features: filteredFeatures 
    };

    const pathsGeojson = { 
      type: 'FeatureCollection', 
      features: pathFeatures.filter(feature => !focusedVessel || feature.properties.mmsi === focusedVessel)
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
      
      // Add CSS for the vessel markers
      const style = document.createElement('style');
      style.textContent = `
        .vessel-marker {
          width: 32px;
          height: 32px;
          background: none;
          cursor: pointer;
        }
        .vessel-marker svg {
          width: 100%;
          height: 100%;
        }
        .vessel-status {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: 1.5px solid #fff;
          box-shadow: 0 0 4px rgba(0,0,0,0.5);
          top: -2px;
          right: -2px;
          z-index: 2;
        }
        .status-working {
          background-color: rgba(76, 175, 80, 0.9);
        }
        .status-transporting {
          background-color: rgba(33, 150, 243, 0.9);
        }
        .status-emptying {
          background-color: rgba(255, 152, 0, 0.9);
        }
        .status-not-active {
          background-color: rgba(158, 158, 158, 0.9);
        }
      `;
      document.head.appendChild(style);
    }

    // Update markers
    const updateMarkers = () => {
      // Clear all existing markers first
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();

      // Create markers for all filtered features
      filteredFeatures.forEach(feature => {
        if (!feature?.properties?.mmsi || !feature?.geometry?.coordinates) {
          console.warn('Invalid feature:', feature);
          return;
        }

        const { coordinates } = feature.geometry;
        const { mmsi, cog = 0 } = feature.properties;
        const [lng, lat] = coordinates;

        // Create marker element
        const el = document.createElement('div');
        el.className = 'vessel-marker';

        // Assign color based on MMSI
        let color = '#007bff'; // Default blue
        if (mmsi === '205196000') color = '#ff0000'; // Red
        else if (mmsi === '205210000') color = '#00ff00'; // Green
        else if (mmsi === '205214000') color = '#ffff00'; // Yellow
        else if (mmsi === '219033078') color = '#ff00ff'; // Magenta
        else if (mmsi === '245043000') color = '#00ffff'; // Cyan

        // Create element content with fixed size SVG
        el.innerHTML = `
          <svg viewBox="0 0 24 24">
            <path d="M12 2L4 20L12 14L20 20L12 2Z" fill="${color}"/>
          </svg>
        `;

        // Add status indicator
        const status = getVesselStatus(mmsi);
        if (status) {
          const statusEl = document.createElement('div');
          statusEl.className = `vessel-status status-${status}`;
          el.appendChild(statusEl);
        }

        // Create new marker with proper options
        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center',
          rotation: cog,
          rotationAlignment: 'map',
          pitchAlignment: 'map',
          offset: [0, 0]
        })
        .setLngLat([lng, lat])
        .addTo(localMap);

        // Add click handler
        el.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('vesselSelected', { detail: feature }));
        });

        // Store marker reference
        markersRef.current.set(mmsi, marker);
      });
    };

    // Initial marker update
    updateMarkers();

    // Add listener for vessel analysis updates
    const handleVesselAnalysisUpdate = () => {
      updateMarkers();
    };

    window.addEventListener('vesselAnalysisUpdated', handleVesselAnalysisUpdate);

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
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': 0.7
        }
      });
    } else {
      localMap.getSource('ais-paths').setData(pathsGeojson);
      localMap.setLayoutProperty('ais-paths-layer', 'visibility', showPaths ? 'visible' : 'none');
    }

    return () => {
      window.removeEventListener('vesselAnalysisUpdated', handleVesselAnalysisUpdate);
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();
    };

  }, [localMap, aisData, selectedTileset, userId, showPaths, PATH_COLORS, focusedVessel, pathTime]);

  useEffect(() => {
    if (!localMap || !userId) return;

    const handleVesselFocusChanged = (event) => {
      setFocusedVessel(event.detail.mmsi);
    };

    const handlePathTimeChanged = (event) => {
      setPathTime(event.detail.timestamp);
    };

    window.addEventListener('vesselFocusChanged', handleVesselFocusChanged);
    window.addEventListener('pathTimeChanged', handlePathTimeChanged);

    return () => {
      window.removeEventListener('vesselFocusChanged', handleVesselFocusChanged);
      window.removeEventListener('pathTimeChanged', handlePathTimeChanged);
    };
  }, [localMap, userId]);

  // Add a function to get vessel status
  const getVesselStatus = (mmsi) => {
    // Get the analysis from the global event
    const analysisEvent = new CustomEvent('getVesselAnalysis', { 
      detail: { mmsi },
      cancelable: true 
    });
    window.dispatchEvent(analysisEvent);
    
    if (analysisEvent.preventDefault) {  // Fix: Check if preventDefault exists
      const analysis = analysisEvent.detail.analysis;
      if (analysis && analysis.content) {
        const match = analysis.content.match(/Category:\s*([^-\n]+)/);
        if (match) {
          return match[1].trim().toLowerCase().replace(/\s+/g, '-');
        }
      }
    }
    return null;
  };

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