import React from 'react';
import { Box, Typography, FormControlLabel, Switch } from '@mui/material';

const AISLive = ({ isAisEnabled, toggleAisTracking }) => {
  const handleAisToggle = (e) => {
    toggleAisTracking(e.target.checked);
  };

  return (
    <Box sx={{ p: 2, color: '#fff' }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
        AIS Live
      </Typography>
      
      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={isAisEnabled}
              onChange={handleAisToggle}
              name="ais"
              color="primary"
            />
          }
          label="Live Vessel Tracking"
        />
      </Box>
      
      <Typography variant="body2" sx={{ color: '#ccc', mt: 2 }}>
        Enable real-time tracking of vessels in your areas of interest.
      </Typography>
    </Box>
  );
};

export default AISLive; 