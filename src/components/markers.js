import { useEffect, useState } from 'react';
// eslint-disable-next-line no-unused-vars
import mapboxgl from 'mapbox-gl';

const Markers = ({ map, userId }) => {
  const [aisData, setAisData] = useState(null);
  const [selectedTileset, setSelectedTileset] = useState(null);

  useEffect(() => {
    if (!map || !userId) return;

    const loadAisData = async () => {
      if (userId !== 'femern@email.com') return;

      try {
        const fileListResponse = await fetch('/data/ais_data/file_list.json');
        if (!fileListResponse.ok) {
          throw new Error(`Failed to load file list: ${fileListResponse.status}`);
        }
        const fileList = await fileListResponse.json();
        console.log('AIS File List:', fileList);

        const fetchPromises = fileList.map(async (file) => {
          const response = await fetch(`/data/ais_data/${file}`);
          if (!response.ok) {
            console.error(`Failed to load ${file}: ${response.status}`);
            return [];
          }
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
        console.log('Loaded AIS Features:', combinedGeojson.features.length);
        setAisData(combinedGeojson);
      } catch (error) {
        console.error('Error loading AIS data:', error);
      }
    };

    const loadArrowImage = () => {
      if (!map.hasImage('arrow')) {
        map.loadImage('/images/arrow.png', (error, image) => {
          if (error) {
            console.error('Error loading arrow image:', error);
            return;
          }
          map.addImage('arrow', image);
          console.log('Arrow image loaded');
        });
      }
    };

    if (map.isStyleLoaded()) {
      loadAisData();
      loadArrowImage();
    } else {
      map.on('load', () => {
        loadAisData();
        loadArrowImage();
      });
    }

    return () => {
      if (map && map.getLayer('ais-ships-layer')) map.removeLayer('ais-ships-layer');
      if (map && map.getSource('ais-ships')) map.removeSource('ais-ships');
    };
  }, [map, userId]);

  useEffect(() => {
    if (!map) return;

    const handleTilesetSelect = (event) => {
      const tileset = event.detail;
      console.log('Received Tileset in Markers.js:', tileset);
      setSelectedTileset(tileset);
    };

    window.addEventListener('tilesetSelected', handleTilesetSelect);

    return () => {
      window.removeEventListener('tilesetSelected', handleTilesetSelect);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !aisData || userId !== 'femern@email.com') {
      if (map && map.getSource('ais-ships')) {
        map.getSource('ais-ships').setData({
          type: 'FeatureCollection',
          features: [],
        });
        window.dispatchEvent(
          new CustomEvent('aisMarkersUpdated', { detail: { active: [], all: aisData?.features || [] } })
        );
      }
      return;
    }

    const tilesetDateStr = selectedTileset?.date;
    if (!tilesetDateStr) {
      if (map && map.getSource('ais-ships')) {
        map.getSource('ais-ships').setData({
          type: 'FeatureCollection',
          features: [],
        });
        window.dispatchEvent(
          new CustomEvent('aisMarkersUpdated', { detail: { active: [], all: aisData.features } })
        );
      }
      return;
    }

    const [datePart, timePart] = tilesetDateStr.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    const tilesetTime = new Date(year, month - 1, day, hours, minutes, seconds);
    if (isNaN(tilesetTime.getTime())) {
      console.error('Invalid tileset date:', tilesetDateStr);
      return;
    }
    console.log('Tileset Time (CET):', tilesetTime);

    const oneMinuteMs = 60 * 1000;
    const shipPositionsWithinOneMinute = {};

    aisData.features.forEach((feature) => {
      const timestampStr = feature.properties.timestamp;
      const [dayStr, monthStr, yearStrTime] = timestampStr.split('/');
      const [yearStr, timeStr] = yearStrTime.split(' ');
      const [hoursStr, minutesStr, secondsStr] = timeStr.split(':');
      const timestamp = new Date(
        Number(yearStr),
        Number(monthStr) - 1,
        Number(dayStr),
        Number(hoursStr),
        Number(minutesStr),
        Number(secondsStr)
      );

      const timeDiffMs = Math.abs(timestamp.getTime() - tilesetTime.getTime());
      const mmsi = feature.properties.mmsi;

      if (timeDiffMs <= oneMinuteMs) {
        if (
          !shipPositionsWithinOneMinute[mmsi] ||
          timestamp > new Date(shipPositionsWithinOneMinute[mmsi].feature.properties.timestamp)
        ) {
          shipPositionsWithinOneMinute[mmsi] = {
            feature,
            timeDiffMs,
          };
        }
      }
    });

    const filteredFeatures = Object.values(shipPositionsWithinOneMinute).map((entry) => entry.feature);

    const filteredGeojson = {
      type: 'FeatureCollection',
      features: filteredFeatures,
    };

    window.dispatchEvent(
      new CustomEvent('aisMarkersUpdated', { detail: { active: filteredFeatures, all: aisData.features } })
    );

    const handleMarkerClick = (e) => {
      const feature = e.features[0];
      window.dispatchEvent(
        new CustomEvent('vesselSelected', { detail: feature })
      );
      console.log('Vessel clicked, dispatched event for MMSI:', feature.properties.mmsi);
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    if (filteredFeatures.length > 0) {
      console.log('Chosen AIS Markers (within 1 minute of', tilesetDateStr, '):');
      filteredFeatures.forEach((feature) => {
        const timestamp = new Date(
          feature.properties.timestamp.split('/')[2].split(' ')[0],
          feature.properties.timestamp.split('/')[1] - 1,
          feature.properties.timestamp.split('/')[0],
          ...feature.properties.timestamp.split(' ')[1].split(':')
        );
        const timeDiffSeconds = (Math.abs(timestamp.getTime() - tilesetTime.getTime()) / 1000).toFixed(2);
        console.log({
          mmsi: feature.properties.mmsi,
          timestamp: feature.properties.timestamp,
          coords: feature.geometry.coordinates,
          cog: feature.properties.cog,
          direction: `${feature.properties.cog}° from north (clockwise)`,
          timeDiffSeconds,
        });
      });

      if (!map.getSource('ais-ships')) {
        map.addSource('ais-ships', {
          type: 'geojson',
          data: filteredGeojson,
        });

        map.addLayer({
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
          paint: {
            'icon-opacity': 1,
          },
        });
        console.log('AIS Layer Added');

        map.on('click', 'ais-ships-layer', handleMarkerClick);
        map.on('mouseenter', 'ais-ships-layer', handleMouseEnter);
        map.on('mouseleave', 'ais-ships-layer', handleMouseLeave);
      } else {
        map.getSource('ais-ships').setData(filteredGeojson);
        console.log('AIS Layer Updated');

        if (!map._listeners.click || !map._listeners.click.some((l) => l.layer === 'ais-ships-layer')) {
          map.on('click', 'ais-ships-layer', handleMarkerClick);
          map.on('mouseenter', 'ais-ships-layer', handleMouseEnter);
          map.on('mouseleave', 'ais-ships-layer', handleMouseLeave);
        }
      }
    } else {
      console.log('No AIS markers within 1 minute of', tilesetDateStr);
      if (map.getSource('ais-ships')) {
        map.getSource('ais-ships').setData({
          type: 'FeatureCollection',
          features: [],
        });
        console.log('AIS Layer Cleared');
      }
    }

    const handleStyleLoad = () => {
      if (map.getSource('ais-ships') && !map.getLayer('ais-ships-layer')) {
        map.addLayer({
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
          paint: {
            'icon-opacity': 1,
          },
        });
        console.log('AIS Layer Re-added after style change');

        map.on('click', 'ais-ships-layer', handleMarkerClick);
        map.on('mouseenter', 'ais-ships-layer', handleMouseEnter);
        map.on('mouseleave', 'ais-ships-layer', handleMouseLeave);
      }
    };

    map.on('style.load', handleStyleLoad);

    return () => {
      map.off('style.load', handleStyleLoad);
      map.off('click', 'ais-ships-layer', handleMarkerClick);
      map.off('mouseenter', 'ais-ships-layer', handleMouseEnter);
      map.off('mouseleave', 'ais-ships-layer', handleMouseLeave);
    };
  }, [map, aisData, selectedTileset, userId]);

  return null;
};

export default Markers;