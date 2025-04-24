import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, CircularProgress, Alert, Button, Collapse, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { captureVesselScreenshot } from '../utils/vesselScreenshot';

const VesselAnalysis = ({ vessel, map }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Use a ref to store analyses for each vessel
  const analysesRef = useRef(new Map());
  
  // Load saved analyses from localStorage on mount
  useEffect(() => {
    try {
      const savedAnalyses = localStorage.getItem('vesselAnalyses');
      if (savedAnalyses) {
        const parsed = JSON.parse(savedAnalyses);
        const analysesMap = new Map(Object.entries(parsed));
        analysesRef.current = analysesMap;
      }
    } catch (err) {
      console.warn('Error loading saved analyses:', err);
    }
  }, []);
  
  // Get the current vessel's analysis from the map using MMSI and timestamp
  const currentAnalysis = vessel ? (
    // Create a composite key using MMSI and timestamp
    (() => {
      const key = `${vessel.properties.mmsi}_${vessel.properties.timestamp}`;
      return analysesRef.current.get(key) || 
      // Try to get from localStorage as fallback
      (() => {
        try {
          const savedAnalyses = JSON.parse(localStorage.getItem('vesselAnalyses') || '{}');
          return savedAnalyses[key];
        } catch (err) {
          return null;
        }
      })();
    })()
  ) : null;
  
  // Reset error when vessel changes
  useEffect(() => {
    setError(null);
  }, [vessel]);

  useEffect(() => {
    const handleGetVesselAnalysis = (event) => {
      const { mmsi, timestamp } = event.detail;
      const key = `${mmsi}_${timestamp}`;
      let analysis = analysesRef.current.get(key);
      
      // If not in memory, try to get from localStorage
      if (!analysis) {
        try {
          const savedAnalyses = JSON.parse(localStorage.getItem('vesselAnalyses') || '{}');
          analysis = savedAnalyses[key];
          if (analysis) {
            analysesRef.current.set(key, analysis);
          }
        } catch (err) {
          console.warn('Error loading analysis from localStorage:', err);
        }
      }
      
      if (analysis) {
        event.preventDefault();
        event.detail.analysis = analysis;
      }
    };

    window.addEventListener('getVesselAnalysis', handleGetVesselAnalysis);
    return () => {
      window.removeEventListener('getVesselAnalysis', handleGetVesselAnalysis);
    };
  }, []);

  const analyzeVessel = async () => {
    if (!vessel || !map) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // First capture the screenshot
      const screenshot = await captureVesselScreenshot({
        map,
        vessel,
        zoomLevel: 17, // Very close zoom level
        width: 800,
        height: 600,
        showMarker: false,
        showCircle: true,
        showLabel: true,
        circleColor: '#ff0000',
        circleRadius: 10,
        download: false // Don't download the image
      });

      // Prepare the vessel data for analysis
      const vesselInfo = {
        name: vessel.properties.name || 'Unknown Vessel',
        mmsi: vessel.properties.mmsi,
        shipType: vessel.properties.shipType || 'N/A',
        speed: vessel.properties.sog,
        course: vessel.properties.cog,
        destination: vessel.properties.destination || 'N/A',
        timestamp: vessel.properties.timestamp,
        position: vessel.geometry.coordinates
      };

      // Prepare the API request body
      const requestBody = {
        model: "pixtral-large-latest", // Using Pixtral model for vision capabilities
        messages: [
          {
            role: "system",
            content: `You are an expert maritime analyst. Analyze the vessel data and provide a structured response in the following format:

Status:
- Moving: [Yes/No]
- Speed: [Current speed in knots]
- Direction: [Current course/heading]
- Destination: [Known destination or 'Unknown']

Activity:
- Type: [Fishing/Cargo/Passenger/Other]
- Status: [Active/Stationary/Anchored]
- Pattern: [Normal/Irregular/Unusual]

${vessel.properties.mmsi === "245043000" ? 
`Visual Analysis:
Analyze the image and identify:
- Current position (DOCK, SEA, HOLDING AREA, or TUNNEL TRENCH WORKING AREA)
- Presence of floating discharge line nearby (if visible)
- Crane position (GREEN CRANE UPRIGHT or GREEN CRANE OUT, if applicable)
- Any other relevant visual cues that help determine the vessel's status

IMPORTANT: If no vessel is visible in the image, simply write "No image provided" for this section.` 
: 
`Visual Analysis:
EXACTLY THIS TEXT AND NOTHING ELSE: "Instructions needed"

IMPORTANT: If no vessel is visible in the image, replace "Instructions needed" with "No image provided".`}

Pattern Analysis:
EXACTLY THIS TEXT AND NOTHING ELSE: "Instructions needed"

Vessel Status:
- Category: [Working/Transporting/Emptying/Not active] (ONLY the status, no explanations)
- Explanation: [Brief explanation of why this status was assigned]
IMPORTANT: A vessel cannot be considered "Working" if it is at 0 speed and at a dock. In such cases, it should be marked as "Not active" instead.

${vessel.properties.mmsi === "245043000" ? `
SPECIAL RULES FOR VESSEL RAYNAERT (TSHD - Trailing Suction Hopper Dredger):
When analyzing this specific vessel (MMSI: 245043000), follow these exact status classification rules:

1. POSITION: DOCK
   - Speed 0: Status = NO ACTIVITY
   - Speed 0-7: Status = TRANSPORT

2. POSITION: SEA
   - Speed 0, NEAR FLOATING DISCHARGE LINE: Status = EMPTYING
   - Speed 0: Status = NO ACTIVITY
   - Speed >0: Status = TRANSPORT

3. POSITION: HOLDING AREA
   - Speed 0: Status = NO ACTIVITY
   - Speed 0-7: Status = TRANSPORT

4. POSITION: TUNNEL TRENCH WORKING AREA
   - Speed 0: Status = NO ACTIVITY
   - Speed 0, NEAR FLOATING DISCHARGE LINE: Status = EMPTYING
   - Speed 0-7, GREEN CRANE UPRIGHT: Status = TRANSPORT
   - Speed 0-4, GREEN CRANE OUT: Status = WORKING
   - Speed >7: Status = TRANSPORT
` : ''}

Risk Assessment:
- Risk Level: [Low/Medium/High]
- Concerns: [List any specific concerns or none]

Summary:
[Combine all available information (status, activity, visual analysis, and risk assessment) into a comprehensive 2-3 sentence summary of the vessel's current state and behavior]`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this vessel data: ${JSON.stringify(vesselInfo)}`
              },
              {
                type: "image_url",
                image_url: screenshot // The screenshot is already in data URL format
              }
            ]
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      };

      // Call Mistral AI API
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_MISTRAL_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const analysisContent = data.choices[0].message.content;
      const analysisTimestamp = new Date().toLocaleString();
      
      // Create analysis object
      const analysis = {
        content: analysisContent,
        timestamp: analysisTimestamp,
        vesselTimestamp: vessel.properties.timestamp, // Store the vessel's timestamp
        screenshot: screenshot // Store the screenshot in the analysis
      };
      
      // Create composite key using MMSI and timestamp
      const key = `${vessel.properties.mmsi}_${vessel.properties.timestamp}`;
      
      // Store in memory
      analysesRef.current.set(key, analysis);
      
      // Store in localStorage
      try {
        const savedAnalyses = JSON.parse(localStorage.getItem('vesselAnalyses') || '{}');
        savedAnalyses[key] = analysis;
        localStorage.setItem('vesselAnalyses', JSON.stringify(savedAnalyses));
      } catch (err) {
        console.warn('Error saving analysis to localStorage:', err);
      }
      
      // Dispatch event to notify that analysis has been updated
      window.dispatchEvent(new CustomEvent('vesselAnalysisUpdated', {
        detail: {
          mmsi: vessel.properties.mmsi,
          timestamp: vessel.properties.timestamp,
          analysis: analysis
        }
      }));
      
      // Force a re-render
      setLoading(false);
    } catch (err) {
      console.error('Error analyzing vessel:', err);
      setError('Failed to analyze vessel data. Please try again later.');
      setLoading(false);
    }
  };

  // Format the analysis text with proper styling
  const formatAnalysis = (text) => {
    if (!text) return null;
    
    // Split the text into sections
    const sections = text.split('\n\n');
    
    // Extract the vessel status for special display
    let vesselStatus = null;
    let vesselStatusExplanation = null;
    
    // First pass to extract vessel status
    for (const section of sections) {
      if (section.includes('Vessel Status:')) {
        const categoryMatch = section.match(/Category:\s*([^-\n]+)/);
        const explanationMatch = section.match(/Explanation:\s*([^-\n]+)/);
        
        if (categoryMatch) {
          vesselStatus = categoryMatch[1].trim();
        }
        
        if (explanationMatch) {
          vesselStatusExplanation = explanationMatch[1].trim();
        }
        
        break;
      }
    }
    
    // Create the status display component if we have a status
    const statusDisplay = vesselStatus ? (
      <Box key="vessel-status" sx={{ 
        mb: 2, 
        p: 2, 
        backgroundColor: getStatusColor(vesselStatus),
        borderRadius: 1,
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <Typography 
          variant="subtitle1" 
          sx={{ 
            color: '#fff', 
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#fff',
              mr: 1,
              boxShadow: '0 0 4px rgba(0,0,0,0.3)',
            }}
          />
          Vessel Status: {vesselStatus}
        </Typography>
      </Box>
    ) : null;
    
    // Format the rest of the sections
    const formattedSections = sections.map((section, index) => {
      // Skip the Vessel Status section as we're handling it separately
      if (section.includes('Vessel Status:')) {
        return null;
      }
      
      // Check if this is a section header
      if (section.includes(':')) {
        // Remove asterisks from the header
        const cleanSection = section.replace(/\*\*/g, '');
        const [header, ...content] = cleanSection.split(':');
        
        return (
          <Box key={index} sx={{ mb: 2 }}>
            <Typography 
              variant="subtitle1" 
              sx={{ 
                color: '#4fc3f7', 
                fontWeight: 'bold',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                pb: 1,
                mb: 1
              }}
            >
              {header.trim()}:
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: '#ccc', 
                whiteSpace: 'pre-line',
                pl: 1
              }}
            >
              {content.join(':').trim()}
            </Typography>
          </Box>
        );
      }
      
      // For the summary section
      if (section.toLowerCase().includes('summary')) {
        // Remove asterisks from the summary
        const cleanSection = section.replace(/\*\*/g, '');
        return (
          <Box key={index} sx={{ mt: 2 }}>
            <Typography 
              variant="subtitle1" 
              sx={{ 
                color: '#4fc3f7', 
                fontWeight: 'bold',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                pb: 1,
                mb: 1
              }}
            >
              Summary:
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: '#ccc', 
                fontStyle: 'italic',
                pl: 1
              }}
            >
              {cleanSection.replace('Summary:', '').trim()}
            </Typography>
          </Box>
        );
      }
      
      return null;
    }).filter(Boolean);
    
    // Return the status display followed by the formatted sections
    return [statusDisplay, ...formattedSections];
  };

  // Helper function to get the appropriate color for each status
  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'working':
        return 'rgba(76, 175, 80, 0.3)'; // Green
      case 'transporting':
        return 'rgba(33, 150, 243, 0.3)'; // Blue
      case 'emptying':
        return 'rgba(255, 152, 0, 0.3)'; // Orange
      case 'not active':
        return 'rgba(158, 158, 158, 0.3)'; // Gray
      default:
        return 'rgba(33, 150, 243, 0.3)'; // Default blue
    }
  };

  // State for expanded sections
  const [expanded, setExpanded] = useState(false);

  // Toggle expanded state
  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  // Helper function to get vessel status from analysis content
  const getVesselStatus = (content) => {
    if (!content) return null;
    
    // Look for the Vessel Status section
    const statusMatch = content.match(/Vessel Status:\s*([^\n]+)/);
    if (statusMatch) {
      // Extract just the status category without the explanation in parentheses
      const statusText = statusMatch[1].trim();
      // Remove any text in parentheses
      const cleanStatus = statusText.replace(/\s*\([^)]*\)/g, '').trim();
      return cleanStatus;
    }
    return null;
  };

  if (!vessel) {
    return null;
  }

  return (
    <Box sx={{ mt: 2, p: 2, backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold' }}>
          AI Analysis
        </Typography>
        <Button 
          variant="contained" 
          onClick={analyzeVessel}
          disabled={loading}
          size="small"
          sx={{ 
            backgroundColor: '#1976d2',
            '&:hover': {
              backgroundColor: '#1565c0'
            },
            minWidth: '100px',
            height: '30px',
            fontSize: '0.75rem'
          }}
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </Button>
      </Box>
      
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <CircularProgress size={24} sx={{ color: '#fff' }} />
        </Box>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {currentAnalysis && !loading && (
        <>
          <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1 }}>
            Analysis performed at: {currentAnalysis.timestamp}
          </Typography>
          
          {/* Always show the vessel status */}
          {formatAnalysis(currentAnalysis.content)[0]}
          
          {/* Collapsible section for additional details */}
          <Box sx={{ mt: 2 }}>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer',
                p: 1,
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)'
                }
              }}
              onClick={handleExpandClick}
            >
              <Typography variant="subtitle1" sx={{ color: '#4fc3f7', fontWeight: 'bold' }}>
                Additional Details
              </Typography>
              <IconButton size="small" sx={{ color: '#4fc3f7' }}>
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box sx={{ pl: 1, pr: 1, pb: 1 }}>
                {/* Show the screenshot if available */}
                {currentAnalysis.screenshot && (
                  <Box sx={{ mb: 2, borderRadius: 1, overflow: 'hidden' }}>
                    <img 
                      src={currentAnalysis.screenshot} 
                      alt="Vessel Location" 
                      style={{ 
                        width: '100%', 
                        height: 'auto',
                        borderRadius: '4px'
                      }} 
                    />
                  </Box>
                )}
                {formatAnalysis(currentAnalysis.content).slice(1)}
              </Box>
            </Collapse>
          </Box>
        </>
      )}
    </Box>
  );
};

export default VesselAnalysis; 