import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';

const AreaRequestPanel = ({ map }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [requestedAreas, setRequestedAreas] = useState(() => {
    // Initialize from localStorage if available
    const savedAreas = localStorage.getItem('requestedAreas');
    return savedAreas ? JSON.parse(savedAreas) : [];
  });
  const [selectedArea, setSelectedArea] = useState(null);
  const [currentDrawing, setCurrentDrawing] = useState(null);
  const drawRef = useRef(null);
  const sourceRef = useRef(null);
  const layerRef = useRef(null);

  // Save areas to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('requestedAreas', JSON.stringify(requestedAreas));
  }, [requestedAreas]);

  // Clear map when component unmounts
  useEffect(() => {
    return () => {
      if (map && map.getSource('selected-area')) {
        map.getSource('selected-area').setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[]]
          }
        });
      }
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;

    // Initialize Mapbox Draw
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true
      },
      defaultMode: 'draw_polygon'
    });

    map.addControl(draw);
    drawRef.current = draw;

    // Add source and layer for selected area
    if (!map.getSource('selected-area')) {
      map.addSource('selected-area', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[]]
          }
        }
      });
    }

    if (!map.getLayer('selected-area-fill')) {
      map.addLayer({
        id: 'selected-area-fill',
        type: 'fill',
        source: 'selected-area',
        paint: {
          'fill-color': '#0080ff',
          'fill-opacity': 0.2
        }
      });
    }

    if (!map.getLayer('selected-area-line')) {
      map.addLayer({
        id: 'selected-area-line',
        type: 'line',
        source: 'selected-area',
        paint: {
          'line-color': '#0080ff',
          'line-width': 2
        }
      });
    }

    // Handle draw events
    map.on('draw.create', updateDrawing);
    map.on('draw.delete', updateDrawing);
    map.on('draw.update', updateDrawing);

    return () => {
      if (drawRef.current) {
        map.removeControl(drawRef.current);
      }
      map.off('draw.create', updateDrawing);
      map.off('draw.delete', updateDrawing);
      map.off('draw.update', updateDrawing);
    };
  }, [map]);

  const updateDrawing = (e) => {
    if (!drawRef.current) return;
    const data = drawRef.current.getAll();
    if (data.features.length > 0) {
      setCurrentDrawing({
        id: data.features[0].id,
        coordinates: data.features[0].geometry.coordinates[0]
      });
    } else {
      setCurrentDrawing(null);
    }
  };

  const handleRequestArea = () => {
    if (!currentDrawing) return;

    const newArea = {
      id: Date.now(),
      coordinates: currentDrawing.coordinates,
      status: 'pending',
      date: new Date().toISOString()
    };

    setRequestedAreas(prev => [...prev, newArea]);
    drawRef.current.deleteAll();
    setCurrentDrawing(null);
  };

  const handleAreaClick = (area) => {
    setSelectedArea(area);
    
    // Update the selected area source
    if (map.getSource('selected-area')) {
      map.getSource('selected-area').setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [area.coordinates]
        }
      });
    }
  };

  const handleDeleteArea = (areaId) => {
    setRequestedAreas(prev => prev.filter(area => area.id !== areaId));
    if (selectedArea?.id === areaId) {
      setSelectedArea(null);
      if (map && map.getSource('selected-area')) {
        map.getSource('selected-area').setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[]]
          }
        });
      }
    }
  };

  return (
    <Box sx={{ p: 2, color: '#fff' }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
        Request New Area
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Draw a polygon on the map to request a new area of interest.
        </Typography>
        <Button
          variant="contained"
          onClick={handleRequestArea}
          sx={{ mb: 2 }}
          disabled={!currentDrawing}
        >
          Request Area
        </Button>
      </Box>

      <Divider sx={{ my: 2, backgroundColor: '#444' }} />

      <Typography variant="h6" sx={{ mb: 2 }}>
        Requested Areas
      </Typography>

      <List>
        {requestedAreas.map((area) => (
          <ListItem
            key={area.id}
            secondaryAction={
              <IconButton 
                edge="end" 
                aria-label="delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteArea(area.id);
                }}
                sx={{ color: '#fff' }}
              >
                <DeleteIcon />
              </IconButton>
            }
            onClick={() => handleAreaClick(area)}
            sx={{
              backgroundColor: selectedArea?.id === area.id ? 'rgba(0, 128, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              mb: 1,
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'rgba(0, 128, 255, 0.3)',
              },
            }}
          >
            <ListItemText
              primary={`Area Request #${area.id}`}
              secondary={`Status: ${area.status} - ${new Date(area.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}`}
            />
          </ListItem>
        ))}
        {requestedAreas.length === 0 && (
          <Typography variant="body2" sx={{ color: '#ccc', fontStyle: 'italic' }}>
            No areas requested yet.
          </Typography>
        )}
      </List>
    </Box>
  );
};

export default AreaRequestPanel; 