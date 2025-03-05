// components/sidepanel3.js
import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  IconButton,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Divider,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Map as MapIcon,
  Star as StarIcon,
  Settings as SettingsIcon,
  HelpOutline as HelpOutlineIcon,
  AccountCircle as AccountCircleIcon,
  ChevronLeft as ChevronLeftIcon,
  CloudDownload as CloudDownloadIcon,
} from '@mui/icons-material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const TOTAL_PANEL_WIDTH = 320;
const ICON_COLUMN_WIDTH = 60;
const MAPBOX_ACCESS_TOKEN =
  'sk.eyJ1Ijoic2ltb252cCIsImEiOiJjbTZzczM1Y3kwOHJrMmpzZjFlNXUwOWNtIn0.449LWA2pOpadwlMduS9TJA';

function calculateCenterFromBounds(bounds) {
  const [minLng, minLat, maxLng, maxLat] = bounds;
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

const SidePanelComposite = ({ onLocationSelect, userId, map }) => {
  // State for menu selection
  const [activeMenu, setActiveMenu] = useState('overview');

  // Data states
  const [locations, setLocations] = useState([]);
  const [userInfo, setUserInfo] = useState({ name: '', location: '' });

  // AOI/tileset selection states
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [subPanelOpen, setSubPanelOpen] = useState(false);
  const [selectedSpecialTileset, setSelectedSpecialTileset] = useState(null);

  // Compare mode states
  const [compareMode, setCompareMode] = useState(false);
  const [compareLeft, setCompareLeft] = useState(null);
  const [compareRight, setCompareRight] = useState(null);
  const [sliderValue, setSliderValue] = useState(50);

  // --- Data fetching ---
  useEffect(() => {
    const userFile = `/data/users/${userId}.json`;
    fetch(userFile)
      .then((res) => res.json())
      .then((data) => {
        setUserInfo({
          name: data.full_name,
          location: data.location,
        });

        const normalLocations = []; // No separate AOI geojson
        const fetchTilesetMetadata = async (tilesetId) => {
          try {
            const response = await fetch(
              `https://api.mapbox.com/v4/simonvp.${tilesetId}.json?access_token=${MAPBOX_ACCESS_TOKEN}`
            );
            const metadata = await response.json();
            if (metadata && metadata.created) {
              return new Date(metadata.created).toISOString();
            }
            const tilesetsResponse = await fetch(
              `https://api.mapbox.com/tilesets/v1/simonvp.${tilesetId}?access_token=${MAPBOX_ACCESS_TOKEN}`
            );
            const tilesetMetadata = await tilesetsResponse.json();
            if (tilesetMetadata && tilesetMetadata.modified) {
              return new Date(tilesetMetadata.modified).toISOString();
            }
          } catch (error) {
            console.warn(`Failed to fetch metadata for tileset ${tilesetId}:`, error);
          }
          return null;
        };

        const tilesets = data.tilesets || [];
        Promise.all(
          tilesets.map(async (ts) => {
            const imageDate = ts.date || (await fetchTilesetMetadata(ts.id)) || '1970-01-01T00:00:00Z';
            let coords = null;
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
            if (!coords) coords = [0, 0];
            const previewUrl = ts.name === 'Area 2' ? '/data/thumbnail2.png' : '/data/thumbnail1.png';
            return {
              id: ts.id,
              name: ts.name,
              location: ts.location,
              coordinates: coords,
              newImagesCount: 'N/A',
              isSpecial: true,
              url: ts.url,
              date: imageDate,
              previewUrl,
              newEvents: ts.newEvents !== undefined ? ts.newEvents : 0,
            };
          })
        ).then((specialLocations) => {
          // Group tilesets by location
          const groupedSpecials = {};
          specialLocations.forEach((ts) => {
            const locKey = ts.location;
            if (!groupedSpecials[locKey]) {
              groupedSpecials[locKey] = {
                id: locKey,
                name: locKey,
                location: locKey,
                isSpecial: true,
                tilesets: [],
                coordinates: ts.coordinates,
              };
            }
            groupedSpecials[locKey].tilesets.push(ts);
          });
          // Sort each group by date (newest first)
          Object.values(groupedSpecials).forEach((group) => {
            group.tilesets.sort((a, b) => new Date(b.date) - new Date(a.date));
          });
          const combinedSpecialLocations = Object.values(groupedSpecials);
          // Combine with normalLocations (empty) + grouped tilesets
          const allLocations = [...normalLocations, ...combinedSpecialLocations];
          setLocations(allLocations);
        });
      })
      .catch(console.error);
  }, [userId]);

  // --- Single-mode tileset visibility ---
  useEffect(() => {
    if (map && selectedIndex !== null && !compareMode) {
      const currentAoi = locations[selectedIndex];
      if (currentAoi && currentAoi.isSpecial) {
        const selectedId = selectedSpecialTileset || currentAoi.tilesets[0].id;
        currentAoi.tilesets.forEach((ts) => {
          map.setLayoutProperty(ts.id, 'visibility', ts.id === selectedId ? 'visible' : 'none');
          if (ts.id === selectedId) {
            map.setPaintProperty(ts.id, 'raster-opacity', 1);
          }
        });
      }
    }
  }, [map, selectedIndex, compareMode, selectedSpecialTileset, locations]);

  // --- Reset opacity on leaving compare mode ---
  useEffect(() => {
    if (map && !compareMode && selectedIndex !== null) {
      const currentAoi = locations[selectedIndex];
      if (currentAoi && currentAoi.isSpecial) {
        const selectedId = selectedSpecialTileset || currentAoi.tilesets[0].id;
        map.setPaintProperty(selectedId, 'raster-opacity', 1);
      }
    }
  }, [compareMode, map, selectedIndex, selectedSpecialTileset, locations]);

  // --- Navigation / Menu Handling ---
  const handleMenuClick = (menu) => {
    setActiveMenu(menu);
    // Reset any AOI selection or compare mode
    setSelectedIndex(null);
    setSubPanelOpen(false);
    setCompareMode(false);
    setSelectedSpecialTileset(null);
  };

  // --- AOI Selection Handler ---
  const handleLocationSelect = (idx, coords) => {
    if (selectedIndex === idx && !subPanelOpen) {
      setSubPanelOpen(true);
      onLocationSelect(coords);
    } else {
      setSelectedIndex(idx);
      setSubPanelOpen(false);
      onLocationSelect(coords);
      setSelectedSpecialTileset(null);
      setCompareMode(false);
    }
  };

  // Single-image selection within a group
  const selectSpecialTileset = (specialGroup, selectedTilesetId) => {
    setSelectedSpecialTileset(selectedTilesetId);
    if (map) {
      specialGroup.tilesets.forEach((ts) => {
        map.setLayoutProperty(ts.id, 'visibility', ts.id === selectedTilesetId ? 'visible' : 'none');
        if (specialGroup.tilesets.length === 1 && ts.id === selectedTilesetId) {
          map.setPaintProperty(ts.id, 'raster-opacity', 1);
        }
      });
    }
  };

  // --- Render: Simple Content for non-AOI menus ---
  const renderSimpleContent = () => {
    switch (activeMenu) {
      case 'overview':
        return (
          <Box sx={{ p: 2, color: '#fff' }}>
            <Typography variant="h5" sx={{ mb: 1, fontWeight: 'bold' }}>
              Overview
            </Typography>
            <Typography variant="body1">Areas of Interest: {locations.length}</Typography>
          </Box>
        );
      case 'highlights':
        return (
          <Box sx={{ p: 2, color: '#fff' }}>
            <Typography variant="h5" sx={{ mb: 1, fontWeight: 'bold' }}>
              Highlights
            </Typography>
            <Typography variant="body1">No highlights to show yet.</Typography>
          </Box>
        );
      case 'settings':
        return (
          <Box sx={{ p: 2, color: '#fff' }}>
            <Typography variant="h5" sx={{ mb: 1, fontWeight: 'bold' }}>
              Settings
            </Typography>
            <Typography variant="body1">Settings content goes here.</Typography>
          </Box>
        );
      case 'help':
        return (
          <Box sx={{ p: 2, color: '#fff' }}>
            <Typography variant="h5" sx={{ mb: 1, fontWeight: 'bold' }}>
              Help
            </Typography>
            <Typography variant="body1">Help content goes here.</Typography>
          </Box>
        );
      case 'profile':
        return (
          <Box sx={{ p: 2, color: '#fff' }}>
            <Typography variant="h5" sx={{ mb: 1, fontWeight: 'bold' }}>
              Profile
            </Typography>
            <Typography variant="body1">Profile content goes here.</Typography>
          </Box>
        );
      default:
        return (
          <Box sx={{ p: 2, color: '#fff' }}>
            <Typography variant="h5" sx={{ mb: 1, fontWeight: 'bold' }}>
              Unknown
            </Typography>
            <Typography variant="body1">Select a menu</Typography>
          </Box>
        );
    }
  };

  // --- Render: AOI Content ---
  const renderAoiContent = () => {
    if (!subPanelOpen) {
      return (
        <Box sx={{ p: 2, color: '#fff' }}>
          <Typography variant="h5" sx={{ mb: 1, fontWeight: 'bold' }}>
            Areas of Interest
          </Typography>
          <List>
            {locations.map((loc, idx) => (
              <ListItemButton
                key={loc.id}
                selected={selectedIndex === idx}
                onClick={() => handleLocationSelect(idx, loc.coordinates)}
                sx={{
                  mb: 1,
                  borderRadius: 1,
                  // Placeholder background: image behind everything in the box
                  background: `linear-gradient(rgba(255,255,255,0.1), rgba(255,255,255,0.1)), url('/images/placeholder.png')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  '&:hover': {
                    background: `linear-gradient(rgba(255,255,255,0.2), rgba(255,255,255,0.2)), url('/images/placeholder.png')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1" sx={{ color: '#fff' }}>
                        {loc.name}
                      </Typography>
                    }
                    secondary={
                      loc.isSpecial ? (
                        <Typography variant="caption" sx={{ color: '#ccc' }}>
                          {loc.tilesets.length} image{loc.tilesets.length > 1 ? 's' : ''}
                        </Typography>
                      ) : (
                        <Typography variant="caption" sx={{ color: '#ccc' }}>
                          {loc.location} - New events: {loc.newImagesCount}
                        </Typography>
                      )
                    }
                  />
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
              </ListItemButton>
            ))}
          </List>
        </Box>
      );
    } else {
      const currentAoi = locations[selectedIndex];
      if (!currentAoi) return null;
      if (currentAoi.isSpecial) {
        if (!compareMode) {
          const selectedId = selectedSpecialTileset || currentAoi.tilesets[0].id;
          if (!selectedSpecialTileset) {
            setSelectedSpecialTileset(currentAoi.tilesets[0].id);
            if (map) {
              currentAoi.tilesets.forEach((ts) => {
                map.setLayoutProperty(ts.id, 'visibility', ts.id === currentAoi.tilesets[0].id ? 'visible' : 'none');
                if (currentAoi.tilesets.length === 1 && ts.id === currentAoi.tilesets[0].id) {
                  map.setPaintProperty(ts.id, 'raster-opacity', 1);
                }
              });
            }
          }
          return (
            <Box sx={{ p: 2, color: '#fff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <IconButton
                  onClick={() => {
                    setSubPanelOpen(false);
                    setSelectedIndex(null);
                    setSelectedSpecialTileset(null);
                    setCompareMode(false);
                  }}
                  sx={{ color: '#fff' }}
                >
                  <ChevronLeftIcon />
                </IconButton>
                <Typography variant="h5" sx={{ ml: 1, fontWeight: 'bold' }}>
                  {currentAoi.name} - Details
                </Typography>
              </Box>
              <FormControl fullWidth sx={{ mb: 2 }}>
  <InputLabel id="date-select-label" sx={{ color: '#fff' }}>
    Select Date
  </InputLabel>
  <Select
    variant="outlined"
    labelId="date-select-label"
    value={selectedId}
    label="Select Date"
    onChange={(e) => selectSpecialTileset(currentAoi, e.target.value)}
    sx={{
      color: '#fff',
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: 'primary.main',
      },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: 'primary.main',
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: 'primary.main',
      },
    }}
  >
    {currentAoi.tilesets.map((ts) => (
      <MenuItem key={ts.id} value={ts.id}>
        {new Date(ts.date).toLocaleDateString()}
      </MenuItem>
    ))}
  </Select>
</FormControl>

              <Box sx={{ p: 2, backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 1, mb: 2 }}>
                {currentAoi.tilesets
                  .filter((ts) => ts.id === selectedId)
                  .map((ts) => (
                    <Box key={ts.id}>
                      <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 'bold' }}>
                        {ts.name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#ccc' }}>
                        <strong>Location:</strong> {ts.location}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#ccc' }}>
                        <strong>Date:</strong> {new Date(ts.date).toLocaleDateString()}
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
                  ))}
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Button
                  variant="contained"
                  onClick={() => {
                    if (currentAoi.tilesets.length >= 2) {
                      setCompareLeft(currentAoi.tilesets[0].id);
                      setCompareRight(currentAoi.tilesets[1].id);
                    } else {
                      setCompareLeft(currentAoi.tilesets[0].id);
                      setCompareRight(currentAoi.tilesets[0].id);
                    }
                    setSliderValue(50);
                    setCompareMode(true);
                  }}
                  sx={{ backgroundColor: '#444', color: '#fff' }}
                >
                  Compare Dates
                </Button>
              </Box>
            </Box>
          );
        } else {
          const leftImage = currentAoi.tilesets.find((ts) => ts.id === compareLeft) || currentAoi.tilesets[0];
          const rightImage = currentAoi.tilesets.find((ts) => ts.id === compareRight) || currentAoi.tilesets[0];
          if (map && leftImage && rightImage) {
            map.setLayoutProperty(leftImage.id, 'visibility', 'visible');
            map.setLayoutProperty(rightImage.id, 'visibility', 'visible');
          }
          return (
            <Box sx={{ p: 2, color: '#fff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <IconButton onClick={() => setCompareMode(false)} sx={{ color: '#fff' }}>
                  <ChevronLeftIcon />
                </IconButton>
                <Typography variant="h5" sx={{ ml: 1, fontWeight: 'bold' }}>
                  Back to Details
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
                Compare Dates for {currentAoi.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <FormControl fullWidth>
                  <InputLabel id="left-date-select-label" sx={{ color: '#fff' }}>
                    Left Image
                  </InputLabel>
                  <Select
                    labelId="left-date-select-label"
                    value={compareLeft || currentAoi.tilesets[0].id}
                    label="Left Image"
                    onChange={(e) => {
                      setCompareLeft(e.target.value);
                      if (map) {
                        map.setPaintProperty(e.target.value, 'raster-opacity', (100 - sliderValue) / 100);
                      }
                    }}
                    sx={{ color: '#fff', borderColor: '#fff' }}
                  >
                    {currentAoi.tilesets.map((ts) => (
                      <MenuItem key={ts.id} value={ts.id}>
                        {new Date(ts.date).toLocaleDateString()}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel id="right-date-select-label" sx={{ color: '#fff' }}>
                    Right Image
                  </InputLabel>
                  <Select
                    labelId="right-date-select-label"
                    value={compareRight || (currentAoi.tilesets[1] && currentAoi.tilesets[1].id)}
                    label="Right Image"
                    onChange={(e) => {
                      setCompareRight(e.target.value);
                      if (map) {
                        map.setPaintProperty(e.target.value, 'raster-opacity', sliderValue / 100);
                      }
                    }}
                    sx={{ color: '#fff', borderColor: '#fff' }}
                  >
                    {currentAoi.tilesets.map((ts) => (
                      <MenuItem key={ts.id} value={ts.id}>
                        {new Date(ts.date).toLocaleDateString()}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={sliderValue}
                  onChange={(e, newValue) => {
                    setSliderValue(newValue);
                    if (map && compareLeft && compareRight) {
                      map.setPaintProperty(compareLeft, 'raster-opacity', (100 - newValue) / 100);
                      map.setPaintProperty(compareRight, 'raster-opacity', newValue / 100);
                    }
                  }}
                  min={0}
                  max={100}
                  valueLabelDisplay="auto"
                  sx={{ color: '#fff' }}
                />
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ color: '#ccc' }}>
                  <strong>Left Image Date:</strong>{' '}
                  {new Date(currentAoi.tilesets.find((ts) => ts.id === compareLeft)?.date).toLocaleDateString()}
                </Typography>
                <Typography variant="body2" sx={{ color: '#ccc' }}>
                  <strong>Right Image Date:</strong>{' '}
                  {new Date(currentAoi.tilesets.find((ts) => ts.id === compareRight)?.date).toLocaleDateString()}
                </Typography>
              </Box>
            </Box>
          );
        }
      } else {
        return (
          <Box sx={{ p: 2, color: '#fff' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <IconButton
                onClick={() => {
                  setSubPanelOpen(false);
                  setSelectedIndex(null);
                }}
                sx={{ color: '#fff' }}
              >
                <ChevronLeftIcon />
              </IconButton>
              <Typography variant="h5" sx={{ ml: 1, fontWeight: 'bold' }}>
                {currentAoi.name} - Details
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#ccc' }}>
              <strong>Location:</strong> {currentAoi.location}
            </Typography>
            <Typography variant="body2" sx={{ color: '#ccc' }}>
              <strong>New events:</strong> {currentAoi.newImagesCount}
            </Typography>
          </Box>
        );
      }
    }
  };

  const renderActiveContent = () => {
    if (activeMenu === 'aoi') {
      return renderAoiContent();
    }
    return renderSimpleContent();
  };

  return (
    <Drawer
      variant="permanent"
      anchor="left"
      sx={{
        width: TOTAL_PANEL_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: TOTAL_PANEL_WIDTH,
          boxSizing: 'border-box',
          backgroundColor: 'transparent', // overall paper is transparent
          color: '#fff',
          border: '0px solid #444',
          height: 'calc(100vh - 16px)',
          margin: '8px',
          borderRadius: '10px',
          boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'row',
        },
      }}
      open
    >
      {/* Left column: icons and small logo */}
      <Box
        sx={{
          width: ICON_COLUMN_WIDTH,
          backgroundColor: '#111', // dark background for left column
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          borderRight: '1px solid #444',
          py: 2,
        }}
      >
        {/* Small logo */}
        <Box sx={{ mb: 3 }}>
          <img
            src="/images/spacelinelogowhitesmall.png"
            alt="Logo"
            style={{ width: '30px', height: 'auto' }}
          />
        </Box>
        {/* Top icons */}
        <List>
          <ListItemButton onClick={() => handleMenuClick('overview')} sx={{ justifyContent: 'center', mb: 1 }}>
            <DashboardIcon sx={{ color: activeMenu === 'overview' ? 'primary.main' : '#fff' }} />
          </ListItemButton>
          <ListItemButton onClick={() => handleMenuClick('aoi')} sx={{ justifyContent: 'center', mb: 1 }}>
            <MapIcon sx={{ color: activeMenu === 'aoi' ? 'primary.main' : '#fff' }} />
          </ListItemButton>
          <ListItemButton onClick={() => handleMenuClick('highlights')} sx={{ justifyContent: 'center', mb: 1 }}>
            <StarIcon sx={{ color: activeMenu === 'highlights' ? 'primary.main' : '#fff' }} />
          </ListItemButton>
        </List>
        <Box sx={{ flexGrow: 1 }} />
        {/* Bottom icons */}
        <List>
          <ListItemButton onClick={() => handleMenuClick('settings')} sx={{ justifyContent: 'center', mb: 1 }}>
            <SettingsIcon sx={{ color: activeMenu === 'settings' ? 'primary.main' : '#fff' }} />
          </ListItemButton>
          <ListItemButton onClick={() => handleMenuClick('help')} sx={{ justifyContent: 'center', mb: 1 }}>
            <HelpOutlineIcon sx={{ color: activeMenu === 'help' ? 'primary.main' : '#fff' }} />
          </ListItemButton>
          <ListItemButton onClick={() => handleMenuClick('profile')} sx={{ justifyContent: 'center' }}>
            <AccountCircleIcon sx={{ color: activeMenu === 'profile' ? 'primary.main' : '#fff' }} />
          </ListItemButton>
        </List>
      </Box>

      {/* Right column: main content with blurred, dark transparent background */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {renderActiveContent()}
      </Box>
    </Drawer>
  );
};

export default SidePanelComposite;
