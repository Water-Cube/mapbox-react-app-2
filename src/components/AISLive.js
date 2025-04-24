import React, { useState, useEffect } from 'react';
import { Box, Typography, FormControlLabel, Switch, CircularProgress, IconButton } from '@mui/material';
import { ChevronLeft as ChevronLeftIcon } from '@mui/icons-material';

const AISLive = ({ isAisEnabled, toggleAisTracking, isLoading = false }) => {
  const [selectedVessel, setSelectedVessel] = useState(null);

  // Listen for vessel selection events
  useEffect(() => {
    const handleVesselSelected = (event) => {
      setSelectedVessel(event.detail);
    };

    window.addEventListener('vesselSelected', handleVesselSelected);
    
    return () => {
      window.removeEventListener('vesselSelected', handleVesselSelected);
    };
  }, []);

  const handleAisToggle = (e) => {
    toggleAisTracking(e.target.checked);
  };

  // If a vessel is selected, show vessel details
  if (selectedVessel) {
    return (
      <Box sx={{ p: 2, color: '#fff' }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          mb: 2 
        }}>
          <IconButton 
            onClick={() => setSelectedVessel(null)} 
            sx={{ color: '#fff', mr: 1 }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            {selectedVessel.properties.name}
          </Typography>
        </Box>
        
        <Box sx={{ 
          backgroundColor: 'rgba(255,255,255,0.1)', 
          p: 2, 
          borderRadius: '5px',
          borderLeft: `3px solid ${selectedVessel.properties.color || '#007bff'}`,
        }}>
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>MMSI:</strong> {selectedVessel.properties.mmsi}
          </Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>IMO:</strong> {selectedVessel.properties.imo}
          </Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>Position:</strong> {selectedVessel.geometry.coordinates[1].toFixed(4)}, {selectedVessel.geometry.coordinates[0].toFixed(4)}
          </Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>Speed:</strong> {selectedVessel.properties.sog} knots
          </Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>Course:</strong> {selectedVessel.properties.cog}°
          </Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>Heading:</strong> {selectedVessel.properties.heading}°
          </Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>Destination:</strong> {selectedVessel.properties.destination}
          </Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>Last Update:</strong> {selectedVessel.properties.timestamp}
          </Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>Source:</strong> {selectedVessel.properties.aisSource}
          </Typography>
        </Box>
      </Box>
    );
  }

  // Default view when no vessel is selected
  return (
    <Box sx={{ p: 2, color: '#fff' }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
        AIS Live
      </Typography>
      
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <FormControlLabel
          control={
            <Switch
              checked={isAisEnabled}
              onChange={handleAisToggle}
              name="ais"
              color="primary"
              disabled={isLoading}
            />
          }
          label="Live Vessel Tracking"
        />
        {isLoading && (
          <CircularProgress 
            size={20} 
            sx={{ ml: 2, color: 'primary.main' }} 
          />
        )}
      </Box>
      
      <Typography variant="body2" sx={{ color: '#ccc', mt: 2 }}>
        {isLoading 
          ? "Fetching vessel data... This may take a moment."
          : "Enable real-time tracking of vessels in your areas of interest."
        }
      </Typography>
    </Box>
  );
};

export default AISLive; 