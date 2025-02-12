// components/sidepanel2.js
import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Card,
  CardContent,
  CardMedia,
  Divider,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  Typography,
  IconButton,
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import logo from '../images/spacelinelogo.png';

// Set your Mapbox secret access token (ensure you protect it appropriately)
const MAPBOX_ACCESS_TOKEN =
  'sk.eyJ1Ijoic2ltb252cCIsImEiOiJjbTZzczM1Y3kwOHJrMmpzZjFlNXUwOWNtIn0.449LWA2pOpadwlMduS9TJA';

/**
 * Given an array of [lng, lat] points (a polygon ring),
 * compute and return the center coordinate as [lng, lat].
 */
function getPolygonCenter(polygon) {
  let sumLng = 0,
    sumLat = 0,
    count = 0;
  polygon.forEach(([lng, lat]) => {
    sumLng += lng;
    sumLat += lat;
    count++;
  });
  return [sumLng / count, sumLat / count];
}

/**
 * Given a bounding box array [minLng, minLat, maxLng, maxLat],
 * compute and return the center coordinate as [lng, lat].
 */
function calculateCenterFromBounds(bounds) {
  const [minLng, minLat, maxLng, maxLat] = bounds;
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

const SidePanel = ({ onLocationSelect, userId }) => {
  // Panel visibility and user/location states
  const [isOpen, setIsOpen] = useState(true);
  const [locations, setLocations] = useState([]);
  const [userInfo, setUserInfo] = useState({ name: '', location: '' });
  // Tab state: For main panel, 0 = Overview, 1 = AOI, 2 = Highlights.
  const [activeMainTab, setActiveMainTab] = useState(0);
  // When a location is selected, we allow “sub-panel” (details, events, settings)
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [subPanelOpen, setSubPanelOpen] = useState(false);
  // Sub-tabs: 0 = Details, 1 = Events, 2 = Settings.
  const [activeSubTab, setActiveSubTab] = useState(0);

  // Build the user file path dynamically based on the logged-in userId.
  const userFile = `/data/${userId}.json`;

  useEffect(() => {
    // Fetch user info (including tileset information) from the dynamic user file.
    fetch(userFile)
      .then((res) => res.json())
      .then((data) => {
        setUserInfo({
          name: data.full_name,
          location: data.location,
        });
        // Fetch normal AOIs from aoi.geojson.
        fetch('/data/aoi.geojson')
          .then((r) => r.json())
          .then((aoiGeojson) => {
            const normalLocations = aoiGeojson.features.map((feature) => {
              let coords = feature.geometry.coordinates;
              if (feature.geometry.type === 'Polygon') {
                coords = getPolygonCenter(coords[0]); // Use the first ring
              }
              return {
                id: feature.properties.id,
                name: feature.properties.name,
                location: feature.properties.location,
                coordinates: coords,
                newImagesCount: feature.properties.newImagesCount,
                isSpecial: false,
              };
            });

            // Process special tilesets from the user file.
            const fetchTilesetMetadata = async (tilesetId) => {
              try {
                // Try the TileJSON API (v4)
                const response = await fetch(
                  `https://api.mapbox.com/v4/simonvp.${tilesetId}.json?access_token=${MAPBOX_ACCESS_TOKEN}`
                );
                const metadata = await response.json();
                if (metadata && metadata.created) {
                  return new Date(metadata.created).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });
                }
                // Fallback: Tilesets API (v1)
                const tilesetsResponse = await fetch(
                  `https://api.mapbox.com/tilesets/v1/simonvp.${tilesetId}?access_token=${MAPBOX_ACCESS_TOKEN}`
                );
                const tilesetMetadata = await tilesetsResponse.json();
                if (tilesetMetadata && tilesetMetadata.modified) {
                  return new Date(tilesetMetadata.modified).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });
                }
              } catch (error) {
                console.warn(`Failed to fetch metadata for tileset ${tilesetId}:`, error);
              }
              return 'Unknown';
            };

            const tilesets = data.tilesets || [];
            Promise.all(
              tilesets.map(async (ts) => {
                let coords = null;
                let imageDate = await fetchTilesetMetadata(ts.id);
                try {
                  const response = await fetch(
                    `https://api.mapbox.com/tilesets/v1/simonvp.${ts.id}?access_token=${MAPBOX_ACCESS_TOKEN}`
                  );
                  const metadata = await response.json();
                  if (metadata && metadata.bounds) {
                    coords = calculateCenterFromBounds(metadata.bounds);
                  }
                } catch (error) {
                  console.warn(`Failed to fetch metadata for tileset ${ts.id}:`, error);
                }
                if (!coords) {
                  coords = [0, 0];
                }
                const previewUrl =
                  ts.name === 'Area 2' ? '/data/thumbnail2.png' : '/data/thumbnail1.png';
                return {
                  id: ts.id,
                  name: ts.name,
                  location: ts.location || 'Special Zone',
                  coordinates: coords,
                  newImagesCount: 'N/A',
                  isSpecial: true,
                  url: ts.url,
                  date: imageDate,
                  previewUrl,
                };
              })
            ).then((specialLocations) => {
              const allLocations = [...normalLocations, ...specialLocations];
              setLocations(allLocations);
            });
          })
          .catch((error) => console.error('Error fetching AOI geojson:', error));
      })
      .catch(console.error);
  }, [userId, userFile]);

  // Back button handler for sub-panel view.
  const handleBack = () => {
    setSelectedIndex(null);
    setSubPanelOpen(false);
  };

  // Updated click handler: if a new AOI is selected, open sub-panel;
  // if the same AOI is clicked, toggle sub-panel open.
  const handleLocationSelect = (idx, coords) => {
    if (selectedIndex === idx) {
      // If the same AOI is clicked and sub-panel is already open, do nothing.
      // (Alternatively, you can toggle off here if desired.)
      setSubPanelOpen(true);
      onLocationSelect(coords, 15); // Fly to the AOI location.
    } else {
      // Select the new AOI, open the sub-panel, and fly to its location.
      setSelectedIndex(idx);
      setSubPanelOpen(true);
      onLocationSelect(coords, 15);
    }
  };

  const togglePanel = () => {
    setIsOpen((prev) => !prev);
    if (isOpen) {
      setSelectedIndex(null);
      setSubPanelOpen(false);
    }
  };

  const handleMainTabChange = (event, newValue) => {
    setActiveMainTab(newValue);
  };

  const handleSubTabChange = (event, newValue) => {
    setActiveSubTab(newValue);
  };

  const renderMainContent = () => {
    if (subPanelOpen) {
      return renderSubPanelContent();
    }
    if (activeMainTab === 0) {
      // Overview
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="body1" sx={{ color: '#ffffff' }}>
            Areas of Interest: {locations.length}
          </Typography>
        </Box>
      );
    }
    if (activeMainTab === 1) {
      // AOI List with visible selection styling
      return (
        <List>
          {locations.map((loc, idx) => (
            <ListItem
              button
              key={idx}
              selected={selectedIndex === idx}
              onClick={() => handleLocationSelect(idx, loc.coordinates)}
              sx={{
                backgroundColor:
                  selectedIndex === idx ? 'rgba(0, 172, 193, 0.5)' : 'transparent',
                borderLeft: selectedIndex === idx ? '4px solid #00acc1' : 'none',
                '&:hover': {
                  backgroundColor:
                    selectedIndex === idx ? 'rgba(0, 172, 193, 0.5)' : 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              <ListItemText
                primary={loc.name}
                secondary={
                  <>
                    <Typography variant="body2" sx={{ color: '#cccccc' }}>
                      {loc.location}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#bbbbbb' }}>
                      New events: {loc.newImagesCount}
                    </Typography>
                  </>
                }
                primaryTypographyProps={{ sx: { color: '#ffffff' } }}
              />
            </ListItem>
          ))}
        </List>
      );
    }
    if (activeMainTab === 2) {
      // Highlights
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="body1" sx={{ color: '#ffffff' }}>
            No highlights to show yet.
          </Typography>
        </Box>
      );
    }
    return null;
  };

  const renderSubPanelContent = () => {
    const currentAoi = locations[selectedIndex];
    if (!currentAoi) return null;

    return (
      <Box sx={{ p: 2 }}>
        {/* Back Button */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton onClick={handleBack} sx={{ color: '#ffffff' }}>
            <ChevronLeft />
          </IconButton>
          <Typography variant="body1" sx={{ color: '#ffffff', ml: 1 }}>
            Back to AOI List
          </Typography>
        </Box>

        {/* Render sub-panel content based on active sub-tab */}
        {activeSubTab === 0 && (
          <>
            {currentAoi.isSpecial ? (
              <Card sx={{ display: 'flex', mb: 2, backgroundColor: '#444444' }}>
                <CardMedia
                  component="img"
                  sx={{ width: 80 }}
                  image={currentAoi.previewUrl}
                  alt={`${currentAoi.name} preview`}
                />
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#ffffff' }}>
                    {currentAoi.name} - Details
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#cccccc' }}>
                    <strong>Location:</strong> {currentAoi.location}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#cccccc' }}>
                    <strong>Date:</strong> {currentAoi.date}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#cccccc' }}>
                    <strong>New events:</strong> {currentAoi.newImagesCount}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <Box>
                <Typography variant="h6" sx={{ color: '#ffffff', mb: 1 }}>
                  {currentAoi.name} - Details
                </Typography>
                <Typography variant="body2" sx={{ color: '#cccccc' }}>
                  <strong>Location:</strong> {currentAoi.location}
                </Typography>
                <Typography variant="body2" sx={{ color: '#cccccc' }}>
                  <strong>New events:</strong> {currentAoi.newImagesCount}
                </Typography>
              </Box>
            )}
          </>
        )}
        {activeSubTab === 1 && (
          <Box>
            <Typography variant="h6" sx={{ color: '#ffffff', mb: 1 }}>
              {currentAoi.name} - Events
            </Typography>
            <Typography variant="body2" sx={{ color: '#cccccc' }}>
              Here you can list or detail events for {currentAoi.name}.
            </Typography>
          </Box>
        )}
        {activeSubTab === 2 && (
          <Box>
            <Typography variant="h6" sx={{ color: '#ffffff', mb: 1 }}>
              {currentAoi.name} - Settings
            </Typography>
            <Typography variant="body2" sx={{ color: '#cccccc' }}>
              Configuration options for {currentAoi.name}...
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <>
      <Drawer
        variant="persistent"
        anchor="left"
        open={isOpen}
        sx={{
          width: 320,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 320,
            boxSizing: 'border-box',
            backgroundColor: '#333333',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            p: 2,
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Logo */}
          <Box sx={{ mb: 2 }}>
            <img src={logo} alt="SpaceLine Labs Logo" style={{ width: '280px' }} />
          </Box>
          {/* User Info Card */}
          <Card sx={{ backgroundColor: '#444444', mb: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ color: '#ffffff' }}>
                {userInfo.name}
              </Typography>
              <Typography variant="body2" sx={{ color: '#cccccc' }}>
                {userInfo.location}
              </Typography>
            </CardContent>
          </Card>
          <Divider sx={{ backgroundColor: '#555555' }} />
          {/* Main Tabs or Sub-Panel Tabs */}
          {!subPanelOpen ? (
            <Tabs
              value={activeMainTab}
              onChange={handleMainTabChange}
              variant="fullWidth"
              textColor="inherit"
              indicatorColor="primary"
              sx={{ mb: 1 }}
            >
              <Tab label="Overview" />
              <Tab label="AOI" />
              <Tab label="Highlights" />
            </Tabs>
          ) : (
            <Tabs
              value={activeSubTab}
              onChange={handleSubTabChange}
              variant="fullWidth"
              textColor="inherit"
              indicatorColor="primary"
              sx={{ mb: 1 }}
            >
              <Tab label="Details" />
              <Tab label="Events" />
              <Tab label="Settings" />
            </Tabs>
          )}
          {/* Content Area */}
          <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>{renderMainContent()}</Box>
        </Box>
        {/* Toggle Button Positioned Outside the Drawer */}
        <IconButton
          onClick={togglePanel}
          sx={{
            position: 'absolute',
            top: 10,
            right: -40,
            backgroundColor: '#555555',
            color: '#ffffff',
            '&:hover': { backgroundColor: '#777777' },
          }}
        >
          {isOpen ? <ChevronLeft /> : <ChevronRight />}
        </IconButton>
      </Drawer>
    </>
  );
};

export default SidePanel;
