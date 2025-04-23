import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import VesselFinderAIS from './VesselFinderAIS';
import Markers from './markers';
import './map.css';
import Sidepanel from './sidepanel';

// Create a memoized version of VesselFinderAIS to prevent unnecessary re-renders
const MemoizedVesselFinderAIS = React.memo(VesselFinderAIS);

const MapboxExample = ({ selectedCoordinates, userId, onMapLoad, showPaths, togglePaths, isAisEnabled = false, toggleAisTracking }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const tilesetsRef = useRef([]);
  const [map, setMap] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const [coordinates, setCoordinates] = useState({ lat: '--', lng: '--' });
  const [mapStyle, setMapStyle] = useState('dark');

  const handleLocationSelect = (coordinates) => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: coordinates,
        zoom: 12,
        speed: 1.5,
      });
    }
  };

  const handleTilesetSelect = (tilesetId) => {
    if (mapRef.current) {
      const tilesets = tilesetsRef.current;
      tilesets.forEach(ts => {
        const isVisible = ts.id === tilesetId;
        mapRef.current.setLayoutProperty(ts.id, 'visibility', isVisible ? 'visible' : 'none');
      });
    }
  };

  useEffect(() => {
    if (!mapboxgl.supported()) {
      setIsSupported(false);
      return;
    }

    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

    const denmarkCenter = [9.5018, 56.2639];

    const initializeMap = (centerCoordinates) => {
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: centerCoordinates,
        zoom: 6,
        attributionControl: false,
        preserveDrawingBuffer: true,
      });

      setMap(mapRef.current);
      if (onMapLoad) onMapLoad(mapRef.current);

      mapRef.current.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
      mapRef.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right', { offset: [0, -50] });

      mapRef.current.on('mousemove', (e) => {
        setCoordinates({ lat: e.lngLat.lat.toFixed(4), lng: e.lngLat.lng.toFixed(4) });
      });

      // Add satellite layer
      mapRef.current.on('load', () => {
        mapRef.current.addSource('satellite', {
          type: 'raster',
          url: 'mapbox://mapbox.satellite'
        });

        mapRef.current.addLayer({
          id: 'satellite-layer',
          type: 'raster',
          source: 'satellite',
          layout: { visibility: 'none' }
        });
      });
    };

    initializeMap(denmarkCenter);

    mapRef.current.on('load', () => {
      fetch(`/data/users/${userId}.json`)
        .then((res) => res.json())
        .then((data) => {
          const tilesets = data.tilesets || [];
          tilesetsRef.current = tilesets;
          tilesets.forEach((ts) => {
            if (mapRef.current.getLayer(ts.id)) mapRef.current.removeLayer(ts.id);
            if (mapRef.current.getSource(ts.id)) mapRef.current.removeSource(ts.id);

            mapRef.current.addSource(ts.id, {
              type: 'raster',
              url: ts.url,
              tileSize: 256,
            });

            mapRef.current.addLayer({
              id: ts.id,
              type: 'raster',
              source: ts.id,
              paint: { 'raster-opacity': 1 },
              layout: { visibility: 'none' },
            });
          });
        })
        .catch((error) => console.error('Error fetching user file:', error));
    });

    const handleStyleLoad = () => {
      if (tilesetsRef.current.length > 0) {
        tilesetsRef.current.forEach((ts) => {
          if (mapRef.current.getLayer(ts.id)) mapRef.current.removeLayer(ts.id);
          if (mapRef.current.getSource(ts.id)) mapRef.current.removeSource(ts.id);

          mapRef.current.addSource(ts.id, {
            type: 'raster',
            url: ts.url,
            tileSize: 256,
          });

          mapRef.current.addLayer({
            id: ts.id,
            type: 'raster',
            source: ts.id,
            paint: { 'raster-opacity': 1 },
            layout: { visibility: 'none' },
          });
        });
      }
    };

    mapRef.current.on('style.load', handleStyleLoad);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, [userId, onMapLoad]);

  useEffect(() => {
    if (mapRef.current && selectedCoordinates) {
      mapRef.current.flyTo({
        center: selectedCoordinates,
        zoom: 12,
        speed: 1.5,
      });
      console.log('Map flying to selectedCoordinates:', selectedCoordinates);
    }
  }, [selectedCoordinates]);

  const toggleMapStyle = () => {
    if (mapRef.current) {
      const isSatelliteVisible = mapRef.current.getLayoutProperty('satellite-layer', 'visibility') === 'visible';
      mapRef.current.setLayoutProperty('satellite-layer', 'visibility', isSatelliteVisible ? 'none' : 'visible');
      setMapStyle(isSatelliteVisible ? 'dark' : 'satellite');
    }
  };

  return (
    <div className="map-container" ref={mapContainerRef}>
      {!isSupported && (
        <div className="error-message">
          Your browser does not support Mapbox GL JS. Please use a modern browser.
        </div>
      )}
      {map && (
        <>
          <Markers
            map={map}
            selectedCoordinates={selectedCoordinates}
            onLocationSelect={handleLocationSelect}
            userId={userId}
            onTilesetSelect={handleTilesetSelect}
            showPaths={showPaths}
            togglePaths={togglePaths}
          />
          <MemoizedVesselFinderAIS map={map} isEnabled={isAisEnabled} toggleAisTracking={toggleAisTracking} />
        </>
      )}
    </div>
  );
};

export default MapboxExample;