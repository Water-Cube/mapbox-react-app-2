import React, { useState } from 'react';
import { Button } from '@mui/material';
import { PhotoCamera as PhotoCameraIcon } from '@mui/icons-material';
import { captureVesselScreenshot } from '../utils/vesselScreenshot';

/**
 * Component for capturing vessel screenshots
 */
const VesselScreenshot = ({ map, vessel }) => {
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = async () => {
    if (!map || !vessel) return;
    
    setIsCapturing(true);
    try {
      await captureVesselScreenshot({
        map,
        vessel,
        zoomLevel: 17, // Very close zoom level
        width: 800,
        height: 600,
        showMarker: false,
        showCircle: true,
        showLabel: true,
        circleColor: '#ff0000',
        circleRadius: 10
      });
    } catch (error) {
      console.error('Error capturing screenshot:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <Button
      variant="contained"
      size="small"
      color="success"
      onClick={handleCapture}
      startIcon={<PhotoCameraIcon />}
      disabled={isCapturing}
      sx={{ 
        minWidth: '100px',
        backgroundColor: '#4caf50',
        '&:hover': {
          backgroundColor: '#388e3c'
        }
      }}
    >
      {isCapturing ? 'Capturing...' : 'Capture'}
    </Button>
  );
};

export default VesselScreenshot; 