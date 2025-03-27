import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Markers from './markers';

const MapboxExample = ({ selectedCoordinates, userId, onMapLoad, showPaths, togglePaths }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const tilesetsRef = useRef([]);
  const [map, setMap] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const [coordinates, setCoordinates] = useState({ lat: '--', lng: '--' });
  const [mapStyle, setMapStyle] = useState('dark');
  const [selectedTileset, setSelectedTileset] = useState(null);

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

      mapRef.current.on('mousemove', (e) => {
        setCoordinates({ lat: e.lngLat.lat.toFixed(4), lng: e.lngLat.lng.toFixed(4) });
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
    const newStyle =
      mapStyle === 'dark'
        ? 'mapbox://styles/mapbox/satellite-streets-v11'
        : 'mapbox://styles/mapbox/dark-v11';

    setMapStyle(mapStyle === 'dark' ? 'satellite' : 'dark');
    if (mapRef.current) {
      mapRef.current.setStyle(newStyle);
    }
  };

  useEffect(() => {
    const handleTilesetSelect = (event) => {
      const tileset = event.detail;
      console.log('Tileset selected in MapboxExample:', tileset);
      setSelectedTileset(tileset);
    };

    window.addEventListener('tilesetSelected', handleTilesetSelect);

    return () => {
      window.removeEventListener('tilesetSelected', handleTilesetSelect);
    };
  }, []);

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
        <Markers
          map={map}
          userId={userId}
          showControls={false} // Disable Markers' own button
          showPaths={showPaths}
          togglePaths={togglePaths}
        />
      )}
    </>
  );
};

export default MapboxExample;