import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import VesselFinderAIS from './VesselFinderAIS';
import Markers from './markers';
import './map.css';

// Create a memoized version of VesselFinderAIS to prevent unnecessary re-renders
const MemoizedVesselFinderAIS = React.memo(VesselFinderAIS);

const MapboxExample = ({ selectedCoordinates, userId, onMapLoad, showPaths, togglePaths, isAisEnabled = false }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const tilesetsRef = useRef([]);
  const [map, setMap] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const [coordinates, setCoordinates] = useState({ lat: '--', lng: '--' });
  const [mapStyle, setMapStyle] = useState('dark');

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
    <>
      {!isSupported && <p style={{ color: 'red' }}>WebGL is not supported in your browser.</p>}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 11,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            color: 'white',
            background: 'rgba(0, 0, 0, 0.6)',
            padding: '6px 12px',
            borderRadius: '5px',
            boxShadow: '0px 2px 5px rgba(0,0,0,0.2)',
          }}
        >
          Lat: {coordinates.lat}, Lng: {coordinates.lng}
        </div>
        <button
          onClick={toggleMapStyle}
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '5px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            boxShadow: '0px 2px 5px rgba(0,0,0,0.2)',
            transition: 'background 0.3s',
          }}
          onMouseOver={(e) => (e.target.style.background = 'rgba(255, 255, 255, 0.2)')}
          onMouseOut={(e) => (e.target.style.background = 'rgba(0, 0, 0, 0.6)')}
        >
          {mapStyle === 'dark' ? 'Satellite' : 'Standard'}
        </button>
      </div>
      <div ref={mapContainerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
      {map && (
        <>
          <Markers
            map={map}
            userId={userId}
            showControls={false}
            showPaths={showPaths}
            togglePaths={togglePaths}
          />
          <MemoizedVesselFinderAIS map={map} isEnabled={isAisEnabled} />
        </>
      )}
    </>
  );
};

export default MapboxExample;