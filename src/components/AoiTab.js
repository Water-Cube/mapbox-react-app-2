import React, { useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import {
  Box,
  List,
  ListItemButton,
  Typography,
  IconButton,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge,
  Slider,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  CloudDownload as CloudDownloadIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import VesselAnalysis from './VesselAnalysis';
import VesselScreenshot from './VesselScreenshot';
import { useTimeline } from '../context/TimelineContext';

const AoiPanel = ({
  map,
  locations = [],
  selectedIndex,
  subPanelOpen,
  onLocationSelect,
  onTilesetSelect,
  setSelectedIndex,
  setSubPanelOpen,
  aisMarkers,
  selectedVessel,
  setSelectedVessel,
  showPaths,
  togglePaths,
  setActiveMenu,
  selectedVesselSource,
  setSelectedVesselSource,
}) => {
  const [selectedSpecialTileset, setSelectedSpecialTileset] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [focusedVessel, setFocusedVessel] = useState(null);
  const [timeSliderValue, setTimeSliderValue] = useState(0);
  const [pathTimestamps, setPathTimestamps] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playInterval, setPlayInterval] = useState(null);
  const [areaData, setAreaData] = useState(null);
  const [showPolygons, setShowPolygons] = useState(true);
  const [selectedSubarea, setSelectedSubarea] = useState(null);
  const [vesselInSubarea, setVesselInSubarea] = useState(null);
  const { setShowTimeline } = useTimeline();

  useEffect(() => {
    const handleVesselFocusChanged = (event) => {
      setFocusedVessel(event.detail.mmsi);
    };

    window.addEventListener('vesselFocusChanged', handleVesselFocusChanged);

    return () => {
      window.removeEventListener('vesselFocusChanged', handleVesselFocusChanged);
    };
  }, []);

  // Fetch area data when the selected location changes
  useEffect(() => {
    if (selectedIndex !== null && locations[selectedIndex]) {
      const currentAoi = locations[selectedIndex];
      fetch(`/data/users/femern@email.com.json`)
        .then(response => response.json())
        .then(userData => {
          if (userData.areas && userData.areas.length > 0) {
            const selectedArea = userData.areas.find(area => area.location === currentAoi.location);
            if (selectedArea) {
              setAreaData(selectedArea);
            }
          }
        })
        .catch(error => console.error('Error loading user data:', error));
    } else {
      setAreaData(null);
    }
  }, [selectedIndex, locations]);

  useEffect(() => {
    if (!map || selectedIndex === null) return;

    const currentAoi = locations[selectedIndex];
    if (!currentAoi) return;

    // Remove existing area polygons and subarea layers
    ['femern', 'teglholmen', 'nyborg'].forEach(location => {
      // First remove layers
      const layerIds = [
        `${location}-area-layer`,
        `${location}-subarea-0-layer`,
        `${location}-subarea-1-layer`,
        `${location}-subarea-2-layer`
      ];
      
      layerIds.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      });

      // Then remove sources
      const sourceIds = [
        `${location}-area`,
        `${location}-subarea-0`,
        `${location}-subarea-1`,
        `${location}-subarea-2`
      ];
      
      sourceIds.forEach(sourceId => {
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      });
    });

    // Fetch user data to get area coordinates
    fetch(`/data/users/femern@email.com.json`)
      .then(response => response.json())
      .then(data => {
        if (data.areas) {
          const areaData = data.areas.find(a => a.location === currentAoi.location);
          if (areaData) {
            const locationName = currentAoi.location.toLowerCase();
            
            // Add the main area polygon
            if (!map.getSource(`${locationName}-area`)) {
              map.addSource(`${locationName}-area`, {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'Polygon',
                    coordinates: [areaData.coordinates]
                  }
                }
              });

              map.addLayer({
                id: `${locationName}-area-layer`,
                type: 'fill',
                source: `${locationName}-area`,
                layout: {
                  visibility: showPolygons ? 'visible' : 'none'
                },
                paint: {
                  'fill-color': '#0080ff',
                  'fill-opacity': 0.2,
                  'fill-outline-color': '#0080ff'
                }
              });
            }

            // Add subareas if they exist
            if (areaData.subareas) {
              areaData.subareas.forEach((subarea, index) => {
                const sourceId = `${locationName}-subarea-${index}`;
                const layerId = `${locationName}-subarea-${index}-layer`;

                if (!map.getSource(sourceId)) {
                  map.addSource(sourceId, {
                    type: 'geojson',
                    data: {
                      type: 'Feature',
                      properties: {},
                      geometry: {
                        type: 'Polygon',
                        coordinates: [subarea.coordinates]
                      }
                    }
                  });

                  map.addLayer({
                    id: layerId,
                    type: 'fill',
                    source: sourceId,
                    layout: {
                      visibility: showPolygons ? 'visible' : 'none'
                    },
                    paint: {
                      'fill-color': subarea.style.fill,
                      'fill-opacity': 0.4,
                      'fill-outline-color': subarea.style.stroke
                    }
                  });
                }
              });
            }
          }
        }
      })
      .catch(error => {
        console.error('Error loading user data:', error);
      });

    return () => {
      // Cleanup function to remove layers and sources when component unmounts
      ['femern', 'teglholmen', 'nyborg'].forEach(location => {
        // First remove layers
        const layerIds = [
          `${location}-area-layer`,
          `${location}-subarea-0-layer`,
          `${location}-subarea-1-layer`,
          `${location}-subarea-2-layer`
        ];
        
        layerIds.forEach(layerId => {
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
          }
        });

        // Then remove sources
        const sourceIds = [
          `${location}-area`,
          `${location}-subarea-0`,
          `${location}-subarea-1`,
          `${location}-subarea-2`
        ];
        
        sourceIds.forEach(sourceId => {
          if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
          }
        });
      });
    };
  }, [map, selectedIndex, locations, showPolygons]);

  useEffect(() => {
    if (selectedVessel && aisMarkers.all) {
      // Get all timestamps for the selected vessel's path
      const vesselPath = aisMarkers.all
        .filter(feature => feature.properties.mmsi === selectedVessel.properties.mmsi)
        .map(feature => parseTimestamp(feature.properties.timestamp))
        .sort((a, b) => a - b);
      
      // Only keep the last 24 hours of timestamps
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      const recentTimestamps = vesselPath.filter(timestamp => timestamp >= twentyFourHoursAgo);
      
      setPathTimestamps(recentTimestamps);
      setTimeSliderValue(recentTimestamps.length - 1); // Start at the latest position
    }
  }, [selectedVessel, aisMarkers.all]);

  useEffect(() => {
    if (isPlaying && pathTimestamps.length > 0) {
      const interval = setInterval(() => {
        setTimeSliderValue(prevValue => {
          if (prevValue >= pathTimestamps.length - 1) {
            setIsPlaying(false);
            return prevValue;
          }
          return prevValue + 1;
        });
      }, 1000); // Update every second

      setPlayInterval(interval);
    } else if (playInterval) {
      clearInterval(playInterval);
      setPlayInterval(null);
    }

    return () => {
      if (playInterval) {
        clearInterval(playInterval);
      }
    };
  }, [isPlaying, pathTimestamps.length, playInterval]);

  // Initialize selectedIndex if not provided
  useEffect(() => {
    console.log("Component mounted, selectedIndex:", selectedIndex);
    console.log("Locations:", locations);
    
    // If selectedIndex is undefined or null, set it to null
    if (selectedIndex === undefined) {
      console.log("Setting selectedIndex to null");
      setSelectedIndex(null);
    }
  }, [selectedIndex, setSelectedIndex, locations]);

  // Add a new effect to handle the AOI tab being clicked in the sidebar
  useEffect(() => {
    // This effect will run when the component mounts or when selectedIndex changes
    if (selectedIndex !== null && map) {
      // If we have a selected index and the map is available, ensure the polygons are visible
      const currentAoi = locations[selectedIndex];
      if (currentAoi) {
        // Fetch user data to get the area coordinates
        fetch(`/data/users/femern@email.com.json`)
          .then(response => response.json())
          .then(userData => {
            if (userData.areas && userData.areas.length > 0) {
              const selectedArea = userData.areas.find(area => area.location === currentAoi.location);
              if (selectedArea && selectedArea.coordinates) {
                // Ensure the area polygon is visible
                const locationName = currentAoi.location;
                const areaSourceId = `${locationName.toLowerCase()}-area`;
                const areaLayerId = `${locationName.toLowerCase()}-area-layer`;
                
                // Check if the source and layer exist, if not, add them
                if (!map.getSource(areaSourceId)) {
                  map.addSource(areaSourceId, {
                    type: 'geojson',
                    data: {
                      type: 'Feature',
                      properties: {},
                      geometry: {
                        type: 'Polygon',
                        coordinates: selectedArea.coordinates
                      }
                    }
                  });
                  
                  map.addLayer({
                    id: areaLayerId,
                    type: 'fill',
                    source: areaSourceId,
                    layout: {
                      visibility: showPolygons ? 'visible' : 'none'
                    },
                    paint: {
                      'fill-color': '#007bff',
                      'fill-opacity': 0.2,
                      'fill-outline-color': '#007bff'
                    }
                  });
                } else {
                  // If the source exists, update its data
                  map.getSource(areaSourceId).setData({
                    type: 'Feature',
                    properties: {},
                    geometry: {
                      type: 'Polygon',
                      coordinates: selectedArea.coordinates
                    }
                  });
                  // Ensure the layer is visible
                  map.setLayoutProperty(areaLayerId, 'visibility', showPolygons ? 'visible' : 'none');
                }
                
                // Also handle subareas if they exist
                if (selectedArea.subareas && selectedArea.subareas.length > 0) {
                  selectedArea.subareas.forEach((subarea, index) => {
                    const subareaSourceId = `${locationName.toLowerCase()}-subarea-${index}`;
                    const subareaLayerId = `${locationName.toLowerCase()}-subarea-${index}-layer`;
                    
                    // Check if the subarea source and layer exist, if not, add them
                    if (!map.getSource(subareaSourceId)) {
                      map.addSource(subareaSourceId, {
                        type: 'geojson',
                        data: {
                          type: 'Feature',
                          properties: {},
                          geometry: {
                            type: 'Polygon',
                            coordinates: subarea.coordinates
                          }
                        }
                      });
                      
                      map.addLayer({
                        id: subareaLayerId,
                        type: 'fill',
                        source: subareaSourceId,
                        layout: {
                          visibility: showPolygons ? 'visible' : 'none'
                        },
                        paint: {
                          'fill-color': subarea.style.fill,
                          'fill-opacity': subarea.style['fill-opacity'],
                          'fill-outline-color': subarea.style.stroke
                        }
                      });
                    } else {
                      // If the subarea source and layer exist, ensure they're visible
                      map.setLayoutProperty(subareaLayerId, 'visibility', showPolygons ? 'visible' : 'none');
                    }
                  });
                }
              }
            }
          })
          .catch(error => console.error('Error loading user data:', error));
      }
    }
  }, [selectedIndex, map, locations, showPolygons]);

  // Utility function to check if a point is inside a polygon using ray casting algorithm
  const isPointInPolygon = (point, polygon) => {
    const [x, y] = point;
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      
      const intersect = ((yi > y) !== (yj > y)) && 
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
    
    return inside;
  };

  // Function to check if a vessel is within a subarea
  const checkVesselInSubarea = (vessel, subareas) => {
    if (!vessel || !vessel.geometry || !vessel.geometry.coordinates || !subareas || subareas.length === 0) {
      return null;
    }
    
    const [lng, lat] = vessel.geometry.coordinates;
    
    for (const subarea of subareas) {
      if (subarea.coordinates && subarea.coordinates[0]) {
        // The coordinates are in GeoJSON format, which is [longitude, latitude]
        // We need to convert to [x, y] format for the isPointInPolygon function
        const polygon = subarea.coordinates[0].map(coord => [coord[0], coord[1]]);
        
        if (isPointInPolygon([lng, lat], polygon)) {
          return subarea;
        }
      }
    }
    
    return null;
  };

  // Update vesselInSubarea when selectedVessel changes
  useEffect(() => {
    if (selectedVessel && areaData && areaData.subareas) {
      const subarea = checkVesselInSubarea(selectedVessel, areaData.subareas);
      setVesselInSubarea(subarea);
    } else {
      setVesselInSubarea(null);
    }
  }, [selectedVessel, areaData]);

  const handleLocationSelect = (idx, coords) => {
    console.log("handleLocationSelect called with idx:", idx, "coords:", coords);
    
    if (!locations || !locations[idx]) {
      console.error("Invalid location index:", idx);
      return;
    }
    
    const currentAoi = locations[idx];
    console.log("Selected AOI:", currentAoi);

    // Only clear data if we're selecting a different AOI AND the subpanel is not already open
    // AND we're not just entering the AOI tab AND we're not clicking the back button
    if (selectedIndex !== idx && !subPanelOpen && selectedIndex !== null && idx !== selectedIndex) {
      // Clear data only when switching to a different AOI
      setSelectedSpecialTileset(null);
      setSelectedDate('');
      setSelectedVessel(null);
      
      // Clear AIS data by dispatching an event
      window.dispatchEvent(new CustomEvent('clearAisData'));
      
      // Hide ALL tilesets from ALL AOIs if map is available
      if (map) {
        // First hide tilesets from the current AOI
        if (currentAoi.tilesets) {
          currentAoi.tilesets.forEach((ts) => {
            map.setLayoutProperty(ts.id, 'visibility', 'none');
          });
        }
        
        // Then hide tilesets from all other AOIs
        locations.forEach((loc) => {
          if (loc.tilesets) {
            loc.tilesets.forEach((ts) => {
              map.setLayoutProperty(ts.id, 'visibility', 'none');
            });
          }
        });
      }
    }
    
    // Update selection and navigation
    setSelectedIndex(idx);
    setSubPanelOpen(idx === selectedIndex ? !subPanelOpen : false);
    
    // Instead of using the coords parameter, fetch the area polygon from the user data
    // and fly to that area
    fetch(`/data/users/femern@email.com.json`)
      .then(response => response.json())
      .then(userData => {
        if (userData.areas && userData.areas.length > 0) {
          const selectedArea = userData.areas.find(area => area.location === currentAoi.location);
          if (selectedArea && selectedArea.coordinates && map) {
            // Calculate the bounds of the polygon
            const coordinates = selectedArea.coordinates[0]; // Get the first ring of the polygon
            const bounds = coordinates.reduce((bounds, coord) => {
              return bounds.extend(coord);
            }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
            
            // Add some padding to the bounds
            map.fitBounds(bounds, {
              padding: { top: 50, bottom: 50, left: 50, right: 50 },
              maxZoom: 12
            });
          } else {
            // Fallback to the original coords if the area is not found
      onLocationSelect(coords);
          }
    } else {
          // Fallback to the original coords if the user data is not found
      onLocationSelect(coords);
        }
      })
      .catch(error => {
        console.error('Error loading user data:', error);
        // Fallback to the original coords if there's an error
        onLocationSelect(coords);
      });
  };

  const handleDateChange = (event) => {
    const newDate = event.target.value;
    setSelectedDate(newDate);
    
    // If no date is selected, hide all tilesets
    if (!newDate) {
      setSelectedSpecialTileset(null);
        if (onTilesetSelect) {
        onTilesetSelect(null);
      }
      window.dispatchEvent(new CustomEvent('tilesetSelected', { detail: null }));
      
      const currentAoi = locations[selectedIndex];
      if (currentAoi && currentAoi.tilesets && map) {
        currentAoi.tilesets.forEach((ts) => {
          map.setLayoutProperty(ts.id, 'visibility', 'none');
        });
      }
      return;
    }
    
    // Don't automatically select a tileset when a date is selected
    // Just hide all tilesets until the user explicitly selects one
    const currentAoi = locations[selectedIndex];
    if (currentAoi && currentAoi.tilesets && map) {
      currentAoi.tilesets.forEach((ts) => {
        map.setLayoutProperty(ts.id, 'visibility', 'none');
      });
    }
  };

  const handleTilesetChange = (event) => {
    const selectedId = event.target.value;
    setSelectedSpecialTileset(selectedId);
    const currentAoi = locations[selectedIndex];
    if (currentAoi && currentAoi.tilesets) {
      const selectedTileset = currentAoi.tilesets.find((ts) => ts.id === selectedId);
      if (selectedTileset) {
        if (onTilesetSelect) {
          onTilesetSelect(selectedTileset);
        }
        window.dispatchEvent(new CustomEvent('tilesetSelected', { detail: selectedTileset }));
        if (map) {
          currentAoi.tilesets.forEach((ts) => {
            map.setLayoutProperty(ts.id, 'visibility', ts.id === selectedId ? 'visible' : 'none');
            if (ts.id === selectedId) {
              map.setPaintProperty(ts.id, 'raster-opacity', 1);
            }
          });
        }
      }
    }
  };

  const selectSpecialTileset = (specialGroup, selectedTilesetId) => {
    setSelectedSpecialTileset(selectedTilesetId);
    if (selectedTilesetId === 'none') {
      if (map) {
        specialGroup.tilesets.forEach((ts) => {
          map.setLayoutProperty(ts.id, 'visibility', 'none');
        });
      }
      if (onTilesetSelect) {
        onTilesetSelect(null);
      }
      window.dispatchEvent(new CustomEvent('tilesetSelected', { detail: null }));
    } else {
      const selectedTileset = specialGroup.tilesets.find((ts) => ts.id === selectedTilesetId);
      if (selectedTileset) {
        if (onTilesetSelect) {
          onTilesetSelect(selectedTileset);
        }
        window.dispatchEvent(new CustomEvent('tilesetSelected', { detail: selectedTileset }));
      }
      if (map) {
        specialGroup.tilesets.forEach((ts) => {
          map.setLayoutProperty(ts.id, 'visibility', ts.id === selectedTilesetId ? 'visible' : 'none');
          if (specialGroup.tilesets.length === 1 && ts.id === selectedTilesetId) {
            map.setPaintProperty(ts.id, 'raster-opacity', 1);
          }
        });
      }
    }
  };

  const formatDateTimeCET = (dateStr) => {
    const cleanDateStr = dateStr.replace(/Z|[+-]\d{2}:\d{2}$/, '');
    const date = cleanDateStr.split('T')[0];
    const time = cleanDateStr.split('T')[1]?.slice(0, 5) || '';
    return { date, time };
  };

  const parseTimestamp = (timestampStr) => {
    const [dayStr, monthStr, yearStrTime] = timestampStr.split('/');
    const [yearStr, timeStr] = yearStrTime.split(' ');
    const [hoursStr, minutesStr, secondsStr] = timeStr.split(':');
    return new Date(
      Number(yearStr),
      Number(monthStr) - 1,
      Number(dayStr),
      Number(hoursStr),
      Number(minutesStr),
      Number(secondsStr)
    );
  };

  const handleVesselClick = (feature) => {
    setSelectedVessel(feature);
    setActiveMenu('aoi');
    setSelectedVesselSource(subPanelOpen ? 'aoi' : 'overview');
    if (focusedVessel) {
      window.dispatchEvent(new CustomEvent('vesselFocusChanged', { 
        detail: { mmsi: focusedVessel } 
      }));
    }
  };

  const getAoiImageUrl = (loc) => {
    if (!loc || !loc.location) {
      console.log("Invalid location object:", loc);
      return '/images/placeholder.png';
    }
    
    const locationLower = loc.location.toLowerCase();
    if (locationLower.includes('teglholmen')) return '/images/teglholmen.png';
    if (locationLower.includes('nyborg')) return '/images/nyborg.png';
    if (locationLower.includes('femern')) return '/images/femern.png';
    if (locationLower.includes('sevastopol')) return '/images/APSS.jpg';
    return '/images/placeholder.png';
  };

  const handleTimeSliderChange = (event, newValue) => {
    setTimeSliderValue(newValue);
    if (pathTimestamps.length > 0) {
      const selectedTime = pathTimestamps[newValue];
      window.dispatchEvent(new CustomEvent('pathTimeChanged', { 
        detail: { 
          mmsi: selectedVessel.properties.mmsi,
          timestamp: selectedTime
        } 
      }));
    }
  };

  // Add a function to toggle polygon visibility
  const togglePolygonVisibility = () => {
    setShowPolygons(!showPolygons);
    
    if (map && selectedIndex !== null) {
      const currentAoi = locations[selectedIndex];
      const locationName = currentAoi.location;
      
      // Toggle main area polygon
      const areaSourceId = `${locationName.toLowerCase()}-area`;
      const areaLayerId = `${locationName.toLowerCase()}-area-layer`;
      
      if (map.getLayer(areaLayerId)) {
        map.setLayoutProperty(areaLayerId, 'visibility', !showPolygons ? 'visible' : 'none');
      }
      
      // Toggle subarea polygons
      if (areaData && areaData.subareas && areaData.subareas.length > 0) {
        areaData.subareas.forEach((_, index) => {
          const subareaSourceId = `${locationName.toLowerCase()}-subarea-${index}`;
          const subareaLayerId = `${locationName.toLowerCase()}-subarea-${index}-layer`;
          
          if (map.getLayer(subareaLayerId)) {
            map.setLayoutProperty(subareaLayerId, 'visibility', !showPolygons ? 'visible' : 'none');
          }
        });
      }
    }
  };

  // Add a function to handle subarea selection/deselection
  const handleSubareaClick = (subarea) => {
    if (map && selectedIndex !== null) {
      const currentAoi = locations[selectedIndex];
      const locationName = currentAoi.location;
      
      // Check if this subarea is already selected
      if (selectedSubarea && selectedSubarea.id === subarea.id) {
        // Deselect the subarea
        const highlightSourceId = `${locationName.toLowerCase()}-highlight`;
        const highlightLayerId = `${locationName.toLowerCase()}-highlight-layer`;
        
        if (map.getSource(highlightSourceId)) {
          map.removeLayer(highlightLayerId);
          map.removeSource(highlightSourceId);
        }
        
        setSelectedSubarea(null);
        return;
      }
      
      // Remove any existing highlighted subarea
      const areaNames = ['femern', 'teglholmen', 'nyborg'];
      areaNames.forEach(name => {
        const highlightSourceId = `${name}-highlight`;
        const highlightLayerId = `${name}-highlight-layer`;
        if (map.getSource(highlightSourceId)) {
          map.removeLayer(highlightLayerId);
          map.removeSource(highlightSourceId);
        }
      });
      
      // Add the highlighted subarea
      const highlightSourceId = `${locationName.toLowerCase()}-highlight`;
      const highlightLayerId = `${locationName.toLowerCase()}-highlight-layer`;
      
      map.addSource(highlightSourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: subarea.coordinates
          }
        }
      });
      
      map.addLayer({
        id: highlightLayerId,
        type: 'fill',
        source: highlightSourceId,
        layout: {},
        paint: {
          'fill-color': subarea.style.fill,
          'fill-opacity': 0.8,
          'fill-outline-color': subarea.style.stroke
        }
      });
      
      // Fly to the subarea
      const coordinates = subarea.coordinates[0];
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
      
      map.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 13
      });
      
      // Update the selected subarea
      setSelectedSubarea(subarea);
    }
  };

  const renderAoiContent = () => {
    console.log("Rendering AoiContent, locations:", locations);
    console.log("selectedIndex:", selectedIndex);
    
    // Force the areas list view if subPanelOpen is false
    if (selectedIndex === null || !subPanelOpen) {
      return (
        <Box sx={{ p: 2, color: '#fff' }}>
          <Typography variant="h5" sx={{ mb: 1, fontWeight: 'bold' }}>
            Areas of Interest
          </Typography>
          <List>
            {locations && locations.length > 0 ? (
              locations.map((loc, idx) => {
              const imageUrl = getAoiImageUrl(loc);
              return (
                <ListItemButton
                  key={loc.id}
                  selected={selectedIndex === idx}
                  onClick={() => handleLocationSelect(idx, loc.coordinates)}
                  sx={{
                    mb: 1,
                    borderRadius: 1,
                    minHeight: '60px',
                    py: 2,
                    backgroundImage: `url(${imageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    transition: 'background-color 0.2s ease, transform 0.2s ease',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      transform: 'scale(1.02)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Typography variant="subtitle1" sx={{ color: '#fff' }}>
                      {loc.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {(loc.isSpecial ? loc.newEvents : loc.newImagesCount !== 'N/A' && loc.newImagesCount > 0) && (
                        <Badge badgeContent={loc.isSpecial ? loc.newEvents : loc.newImagesCount} color="error">
                          <NotificationsIcon sx={{ color: '#fff' }} />
                        </Badge>
                      )}
                      {selectedIndex === idx && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSubPanelOpen(true);
                            onLocationSelect(loc.coordinates);
                          }}
                          sx={{ ml: 1, borderColor: '#fff', color: '#fff' }}
                        >
                          View Details
                        </Button>
                      )}
                    </Box>
                  </Box>
                </ListItemButton>
              );
              })
            ) : (
              <Typography variant="body1" sx={{ color: '#ccc', fontStyle: 'italic' }}>
                No areas of interest available.
              </Typography>
            )}
          </List>
        </Box>
      );
    } else if (subPanelOpen && !selectedVessel) {
      const currentAoi = locations[selectedIndex];
      if (!currentAoi) return null;

      if (currentAoi.tilesets && currentAoi.tilesets.length > 0) {
        // Hide all tilesets if no date is selected
        if (!selectedDate && map) {
            currentAoi.tilesets.forEach((ts) => {
            map.setLayoutProperty(ts.id, 'visibility', 'none');
            });
        }
        
        // Don't automatically select a tileset when a date is selected
        // This is now handled by the handleTilesetChange function

        const tilesetsByDate = currentAoi.tilesets.reduce((acc, ts) => {
          const { date } = formatDateTimeCET(ts.dateCET);
          if (!acc[date]) acc[date] = [];
          acc[date].push(ts);
          return acc;
        }, {});

        const tilesetsForSelectedDate = selectedDate ? (tilesetsByDate[selectedDate] || currentAoi.tilesets) : [];

        const selectedTileset = currentAoi.tilesets.find((ts) => ts.id === selectedSpecialTileset);
        const tilesetTimeStr = selectedTileset?.date;
        const [datePart, timePart] = tilesetTimeStr ? tilesetTimeStr.split('T') : ['', ''];
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes, seconds] = timePart.split(':').map(Number);
        const tilesetTime = new Date(year, month - 1, day, hours, minutes, seconds);

        const activeMmsiSet = new Set(aisMarkers.active.map((f) => f.properties.mmsi));
        const latestShips = {};
        aisMarkers.all.forEach((feature) => {
          const mmsi = feature.properties.mmsi;
          if (activeMmsiSet.has(mmsi)) return;

          const timestamp = parseTimestamp(feature.properties.timestamp);
          if (!latestShips[mmsi] || timestamp > latestShips[mmsi].timestamp) {
            latestShips[mmsi] = { feature, timestamp };
          }
        });

        const otherShips = Object.values(latestShips)
          .map(({ feature }) => feature)
          .sort((a, b) => {
            const timeA = parseTimestamp(a.properties.timestamp);
            const timeB = parseTimestamp(b.properties.timestamp);
            return Math.abs(tilesetTime - timeA) - Math.abs(tilesetTime - timeB);
          });

        return (
          <Box sx={{ px: 1, py: 2, color: '#fff' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <IconButton
                onClick={() => {
                  setSubPanelOpen(false);
                }}
                sx={{ color: '#fff' }}
              >
                <ChevronLeftIcon />
              </IconButton>
              <Typography variant="h5" sx={{ ml: 1, fontWeight: 'bold' }}>
                {currentAoi.name} - Details
              </Typography>
            </Box>

            {/* Areas and Subareas Section */}
            <Box sx={{ 
              mb: 3, 
              backgroundColor: 'rgba(0, 0, 0, 0.3)', 
              borderRadius: 2, 
              p: 2,
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                mb: 2,
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                pb: 1
              }}>
                <Typography variant="h6" sx={{ 
                  color: '#fff', 
                  fontWeight: 'bold',
                  fontSize: '1.1rem',
                  letterSpacing: '0.5px'
                }}>
                  Main Area: {areaData ? areaData.location : 'Loading...'}
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  onClick={togglePolygonVisibility}
                  sx={{
                    backgroundColor: showPolygons ? '#4caf50' : '#f44336',
                    color: '#fff',
                    minWidth: '80px',
                    '&:hover': {
                      backgroundColor: showPolygons ? '#388e3c' : '#d32f2f',
                    },
                  }}
                >
                  {showPolygons ? 'ON' : 'OFF'}
                </Button>
              </Box>
              
              {areaData ? (
                <Box>
                  {areaData.subareas && areaData.subareas.length > 0 ? (
                    <Box>
                      <Typography variant="subtitle2" sx={{ 
                        color: '#ccc', 
                        mb: 1.5, 
                        mt: 1,
                        fontWeight: 'medium',
                        letterSpacing: '0.5px'
                      }}>
                        Subareas:
                      </Typography>
                      <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: 1.5
                      }}>
                        {areaData.subareas.map((subarea) => (
                          <Box
                            key={subarea.id}
                            onClick={() => handleSubareaClick(subarea)}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              p: 1.5,
                              borderRadius: 1.5,
                              backgroundColor: selectedSubarea && selectedSubarea.id === subarea.id 
                                ? 'rgba(255, 255, 255, 0.15)' 
                                : 'rgba(255, 255, 255, 0.05)',
                              transition: 'all 0.2s ease',
                              cursor: 'pointer',
                              border: selectedSubarea && selectedSubarea.id === subarea.id
                                ? '1px solid rgba(255, 255, 255, 0.2)'
                                : '1px solid rgba(255, 255, 255, 0.05)',
                              '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                transform: 'translateX(5px)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                              },
                            }}
                          >
                            <Box
                              sx={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                backgroundColor: subarea.style.fill,
                                border: `2px solid ${subarea.style.stroke}`,
                                mr: 2,
                                boxShadow: '0 0 8px rgba(0,0,0,0.3)',
                                flexShrink: 0,
                              }}
                            />
                            <Typography variant="body2" sx={{ 
                              color: '#fff', 
                              fontWeight: 'medium',
                              fontSize: '0.95rem',
                              letterSpacing: '0.3px'
                            }}>
                              {subarea.name}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ 
                      color: '#ccc', 
                      fontStyle: 'italic', 
                      mt: 1,
                      p: 1.5,
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 1,
                      border: '1px dashed rgba(255, 255, 255, 0.1)'
                    }}>
                      No subareas defined for this location.
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ 
                  color: '#ccc', 
                  fontStyle: 'italic', 
                  mt: 1,
                  p: 1.5,
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 1,
                  border: '1px dashed rgba(255, 255, 255, 0.1)'
                }}>
                  Loading area data...
                </Typography>
              )}
            </Box>

            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="date-select-label" sx={{ color: '#ccc' }}>Select Date</InputLabel>
                <Select
                  labelId="date-select-label"
                  value={selectedDate}
                  onChange={handleDateChange}
                  sx={{
                    color: '#fff',
                    '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.23)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                    '.MuiSvgIcon-root': { color: '#fff' }
                  }}
                >
                  <MenuItem value="" sx={{ color: '#000' }}>
                    <em>No date selected</em>
                  </MenuItem>
                  {Object.keys(tilesetsByDate).map((date) => (
                    <MenuItem key={date} value={date} sx={{ color: '#000' }}>
                      {date}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedDate && (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel id="tileset-select-label" sx={{ color: '#ccc' }}>Select Time</InputLabel>
                  <Select
                    labelId="tileset-select-label"
                    value={selectedSpecialTileset || ''}
                    onChange={handleTilesetChange}
                    sx={{
                      color: '#fff',
                      '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.23)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                      '.MuiSvgIcon-root': { color: '#fff' }
                    }}
                  >
                    <MenuItem value="" sx={{ color: '#000' }}>
                      <em>No time selected</em>
                    </MenuItem>
                    {tilesetsForSelectedDate.map((ts) => (
                      <MenuItem key={ts.id} value={ts.id} sx={{ color: '#000' }}>
                        {ts.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>

            {selectedDate && selectedSpecialTileset && (
              <Box sx={{ p: 2, backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 1, mb: 2 }}>
                {currentAoi.tilesets
                  .filter((ts) => ts.id === selectedSpecialTileset)
                  .map((ts) => {
                    const { date, time } = formatDateTimeCET(ts.dateCET);
                    return (
                      <Box key={ts.id}>
                        <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 'bold' }}>
                          {ts.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ccc' }}>
                          <strong>Location:</strong> {ts.location}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ccc' }}>
                          <strong>Date:</strong> {date}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ccc' }}>
                          <strong>Time (CET):</strong> {time}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ccc' }}>
                          <strong>New events:</strong> {ts.newEvents}
                        </Typography>
                        {ts.newEvents > 0 && (
                          <Box sx={{ mt: 2 }}>
                            <Button
                              variant="outlined"
                              color="secondary"
                              startIcon={<CloudDownloadIcon />}
                              component="a"
                              href="/FE-1006_25.pdf"
                              download
                              sx={{ borderColor: '#fff', color: '#fff' }}
                            >
                              Download recent report
                            </Button>
                          </Box>
                        )}
                      </Box>
                    );
                  })}
              </Box>
            )}

            {selectedDate && !selectedSpecialTileset && (
              <Box sx={{ p: 2, backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 1, mb: 2 }}>
                <Typography variant="body1" sx={{ color: '#ccc', fontStyle: 'italic' }}>
                  Please select a tileset to view information.
                </Typography>
              </Box>
            )}

            {!selectedDate && (
              <Box sx={{ p: 2, backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 1, mb: 2 }}>
                <Typography variant="body1" sx={{ color: '#ccc', fontStyle: 'italic' }}>
                  Please select a date to view tileset information.
                </Typography>
              </Box>
            )}
            
            {/* Vessel Paths Toggle Button */}
            <Box sx={{ mb: 2 }}>
              <Button
                variant="contained"
                onClick={togglePaths}
                sx={{
                  backgroundColor: showPaths ? '#ff4444' : '#4444ff',
                  color: '#fff',
                  '&:hover': {
                    backgroundColor: showPaths ? '#cc3333' : '#3333cc',
                  },
                }}
              >
                {showPaths ? 'Hide Vessel Paths' : 'Show Vessel Paths'}
              </Button>
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold', mb: 1 }}>
                Active Vessels ({aisMarkers.active.length})
              </Typography>
              {aisMarkers.active.length > 0 ? (
                <Box
                  sx={{
                    maxHeight: '300px',
                    overflowY: 'auto',
                    pr: 1,
                    '&::-webkit-scrollbar': { width: '8px' },
                    '&::-webkit-scrollbar-thumb': { backgroundColor: '#555', borderRadius: '4px' },
                    '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0, 0, 0, 0.2)' },
                  }}
                >
                  {aisMarkers.active.map((feature, index) => {
                    const props = feature.properties;
                    return (
                      <Box
                        key={props.mmsi || index}
                        onClick={() => handleVesselClick(feature)}
                        sx={{
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '8px',
                          p: 2,
                          mb: 1,
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                          cursor: 'pointer',
                          '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)' },
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 'bold', mb: 0.5 }}>
                              {props.name || 'Unknown Vessel'}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#ccc' }}>
                              <strong>MMSI:</strong> {props.mmsi}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#ccc' }}>
                              <strong>Type:</strong> {props.shipType || 'N/A'}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#ccc' }}>
                              <strong>Speed:</strong> {props.sog} knots
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#ccc' }}>
                              <strong>Course:</strong> {props.cog}°
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#ccc' }}>
                              <strong>Timestamp:</strong> {props.timestamp}
                            </Typography>
                          </Box>
                          <Button
                            variant="contained"
                            size="small"
                            color={focusedVessel === props.mmsi ? "secondary" : "primary"}
                            onClick={(e) => {
                              e.stopPropagation();
                              const newFocusedVessel = focusedVessel === props.mmsi ? null : props.mmsi;
                              setFocusedVessel(newFocusedVessel);
                              window.dispatchEvent(new CustomEvent('vesselFocusChanged', { 
                                detail: { mmsi: newFocusedVessel } 
                              }));
                            }}
                            sx={{ ml: 1 }}
                          >
                            {focusedVessel === props.mmsi ? 'Exit Focus' : 'Focus'}
                          </Button>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: '#ccc', fontStyle: 'italic' }}>
                  No active ships detected at this time.
                </Typography>
              )}
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold', mb: 1 }}>
                Other Vessels ({otherShips.length})
              </Typography>
              {otherShips.length > 0 ? (
                <Box
                  sx={{
                    maxHeight: '300px',
                    overflowY: 'auto',
                    pr: 1,
                    '&::-webkit-scrollbar': { width: '8px' },
                    '&::-webkit-scrollbar-thumb': { backgroundColor: '#555', borderRadius: '4px' },
                    '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0, 0, 0, 0.2)' },
                  }}
                >
                  {otherShips.map((feature, index) => {
                    const props = feature.properties;
                    return (
                      <Box
                        key={props.mmsi || index}
                        onClick={() => handleVesselClick(feature)}
                        sx={{
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '8px',
                          p: 2,
                          mb: 1,
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                          cursor: 'pointer',
                          '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)' },
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 'bold', mb: 0.5 }}>
                              {props.name || 'Unknown Vessel'}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#ccc' }}>
                              <strong>MMSI:</strong> {props.mmsi}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#ccc' }}>
                              <strong>Type:</strong> {props.shipType || 'N/A'}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#ccc' }}>
                              <strong>Speed:</strong> {props.sog} knots
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#ccc' }}>
                              <strong>Course:</strong> {props.cog}°
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#ccc' }}>
                              <strong>Timestamp:</strong> {props.timestamp}
                            </Typography>
                          </Box>
                          <Button
                            variant="contained"
                            size="small"
                            color={focusedVessel === props.mmsi ? "secondary" : "primary"}
                            onClick={(e) => {
                              e.stopPropagation();
                              const newFocusedVessel = focusedVessel === props.mmsi ? null : props.mmsi;
                              setFocusedVessel(newFocusedVessel);
                              window.dispatchEvent(new CustomEvent('vesselFocusChanged', { 
                                detail: { mmsi: newFocusedVessel } 
                              }));
                            }}
                            sx={{ ml: 1 }}
                          >
                            {focusedVessel === props.mmsi ? 'Exit Focus' : 'Focus'}
                          </Button>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: '#ccc', fontStyle: 'italic' }}>
                  No other ships in the dataset.
                </Typography>
              )}
            </Box>
            <VesselAnalysis vessel={selectedVessel} map={map} />

            {/* Display vessel location information */}
            {vesselInSubarea && (
              <Box sx={{ 
                mt: 2, 
                p: 2, 
                backgroundColor: 'rgba(33, 150, 243, 0.2)', 
                borderRadius: 1,
                border: '1px solid rgba(33, 150, 243, 0.5)'
              }}>
                <Typography variant="subtitle1" sx={{ 
                  fontWeight: 'bold', 
                  color: '#2196f3',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: vesselInSubarea.style.fill,
                      border: `2px solid ${vesselInSubarea.style.stroke}`,
                      mr: 1,
                      boxShadow: '0 0 4px rgba(0,0,0,0.3)',
                    }}
                  />
                  Vessel Location
              </Typography>
                <Typography variant="body2" sx={{ color: '#fff', mt: 1 }}>
                  Currently in: <strong>{vesselInSubarea.name}</strong>
            </Typography>
              </Box>
            )}
          </Box>
        );
      }
    } else if (selectedVessel) {
      const props = selectedVessel.properties;
      const vesselImage = props.mmsi ? `/images/vessel_${props.mmsi}.png` : '/images/vessel_205210000.png';

      return (
        <Box sx={{ px: 1, py: 2, color: '#fff' }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 2 
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton onClick={() => {
              setSelectedVessel(null);
              setActiveMenu(selectedVesselSource || 'aoi');
            }} sx={{ color: '#fff' }}>
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="h5" sx={{ ml: 1, fontWeight: 'bold' }}>
                {props.name || 'Unknown Vessel'}
            </Typography>
          </Box>
          </Box>
          
          <Box
            component="img"
            src={vesselImage}
            alt={props.name || 'Vessel'}
            onError={(e) => {
              e.target.src = '/images/placeholdervessel.jpg';
            }}
            sx={{
              width: '100%',
              height: '200px',
              objectFit: 'cover',
              borderRadius: '8px',
              mb: 2,
            }}
          />
          <Box sx={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.1)', 
            borderRadius: '8px', 
            p: 2,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 2
          }}>
            <Box>
            <Typography variant="body1" sx={{ color: '#fff', mb: 1 }}>
              <strong>MMSI:</strong> {props.mmsi}
            </Typography>
            <Typography variant="body1" sx={{ color: '#fff', mb: 1 }}>
              <strong>Type:</strong> {props.shipType || 'N/A'}
            </Typography>
            <Typography variant="body1" sx={{ color: '#fff', mb: 1 }}>
              <strong>Speed:</strong> {props.sog} knots
            </Typography>
            </Box>
            <Box>
            <Typography variant="body1" sx={{ color: '#fff', mb: 1 }}>
              <strong>Course:</strong> {props.cog}°
            </Typography>
            <Typography variant="body1" sx={{ color: '#fff', mb: 1 }}>
              <strong>Timestamp:</strong> {props.timestamp}
            </Typography>
            </Box>
          </Box>
          
          {/* AI Analysis */}
          <VesselAnalysis vessel={selectedVessel} map={map} />
          
          {/* Vessel Position Information */}
          {selectedVessel.geometry && selectedVessel.geometry.coordinates && (
            <Box sx={{ 
              mt: 2, 
              p: 2, 
              backgroundColor: 'rgba(33, 150, 243, 0.2)', 
              borderRadius: 1,
              border: '1px solid rgba(33, 150, 243, 0.5)'
            }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#2196f3', mb: 1 }}>
                Vessel Position
                </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <Typography variant="body2" sx={{ color: '#fff' }}>
                  <strong>Longitude:</strong> {selectedVessel.geometry.coordinates[0].toFixed(6)}°
                </Typography>
                <Typography variant="body2" sx={{ color: '#fff' }}>
                  <strong>Latitude:</strong> {selectedVessel.geometry.coordinates[1].toFixed(6)}°
                </Typography>
              </Box>
            </Box>
          )}
          
          {/* Display vessel location information */}
          {vesselInSubarea && (
            <Box sx={{ 
              mt: 2, 
              p: 2, 
              backgroundColor: 'rgba(33, 150, 243, 0.2)', 
              borderRadius: 1,
              border: '1px solid rgba(33, 150, 243, 0.5)'
            }}>
              <Typography variant="subtitle1" sx={{ 
                fontWeight: 'bold', 
                color: '#2196f3',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: vesselInSubarea.style.fill,
                    border: `2px solid ${vesselInSubarea.style.stroke}`,
                    mr: 1,
                    boxShadow: '0 0 4px rgba(0,0,0,0.3)',
                  }}
                />
                Vessel Location
              </Typography>
              <Typography variant="body2" sx={{ color: '#fff', mt: 1 }}>
                Currently in: <strong>{vesselInSubarea.name}</strong>
              </Typography>
              </Box>
            )}
        </Box>
      );
    }
  };

  useEffect(() => {
    // Show timeline only when in details view and no vessel is selected
    setShowTimeline(selectedIndex !== null && subPanelOpen && !selectedVessel);
  }, [selectedIndex, subPanelOpen, selectedVessel, setShowTimeline]);

  return (
    <Box sx={{ padding: '20px' }}>
      {renderAoiContent()}
    </Box>
  );
};

export default AoiPanel;