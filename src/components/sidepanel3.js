// components/sidepanel3.js
import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Button,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  Dashboard as DashboardIcon,
  Map as MapIcon,
  Star as StarIcon,
  Settings as SettingsIcon,
  HelpOutline as HelpOutlineIcon,
  AccountCircle as AccountCircleIcon,
  CloudDownload as CloudDownloadIcon,
} from '@mui/icons-material';

const EXPANDED_WIDTH = 320;
const COLLAPSED_WIDTH = 60;
const MAPBOX_ACCESS_TOKEN =
  'sk.eyJ1Ijoic2ltb252cCIsImEiOiJjbTZzczM1Y3kwOHJrMmpzZjFlNXUwOWNtIn0.449LWA2pOpadwlMduS9TJA';

//
// Helper functions:
//
function getPolygonCenter(polygon) {
  let sumLng = 0, sumLat = 0, count = 0;
  polygon.forEach(([lng, lat]) => {
    sumLng += lng;
    sumLat += lat;
    count++;
  });
  return [sumLng / count, sumLat / count];
}

function calculateCenterFromBounds(bounds) {
  const [minLng, minLat, maxLng, maxLat] = bounds;
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

//
// Composite Component:
// This component expects a valid Mapbox map instance as the `map` prop.
const SidePanelComposite = ({ onLocationSelect, userId, map }) => {
  // Data states
  const [locations, setLocations] = useState([]);
  const [userInfo, setUserInfo] = useState({ name: '', location: '' });
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [subPanelOpen, setSubPanelOpen] = useState(false);

  // For special AOI details, track the currently selected tileset id (for single-image view).
  const [selectedSpecialTileset, setSelectedSpecialTileset] = useState(null);

  // New states for compare mode:
  const [compareMode, setCompareMode] = useState(false);
  const [compareLeft, setCompareLeft] = useState(null);
  const [compareRight, setCompareRight] = useState(null);
  const [sliderValue, setSliderValue] = useState(50);

  // Navigation/Content mode states:
  const [activeMenu, setActiveMenu] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false); // initially expanded

  // --- Data fetching ---
  const userFile = `/data/${userId}.json`;
  useEffect(() => {
    fetch(userFile)
      .then((res) => res.json())
      .then((data) => {
        setUserInfo({
          name: data.full_name,
          location: data.location,
        });
        fetch('/data/aoi.geojson')
          .then((r) => r.json())
          .then((aoiGeojson) => {
            const normalLocations = aoiGeojson.features.map((feature) => {
              let coords = feature.geometry.coordinates;
              if (feature.geometry.type === 'Polygon') {
                coords = getPolygonCenter(coords[0]);
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
                if (!coords) {
                  coords = [0, 0];
                }
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
              Object.values(groupedSpecials).forEach((group) => {
                group.tilesets.sort((a, b) => new Date(b.date) - new Date(a.date));
              });
              const combinedSpecialLocations = Object.values(groupedSpecials);
              const allLocations = [...normalLocations, ...combinedSpecialLocations];
              setLocations(allLocations);
            });
          })
          .catch((error) => console.error('Error fetching AOI geojson:', error));
      })
      .catch(console.error);
  }, [userId, userFile]);

  // --- useEffect to enforce only the latest special tile is visible (when not in compare mode) ---
  useEffect(() => {
    if (map && selectedIndex !== null && !compareMode) {
      const currentAoi = locations[selectedIndex];
      if (currentAoi && currentAoi.isSpecial) {
        const selectedId = selectedSpecialTileset || currentAoi.tilesets[0].id;
        currentAoi.tilesets.forEach((ts) => {
          map.setLayoutProperty(ts.id, 'visibility', ts.id === selectedId ? 'visible' : 'none');
          // Ensure full opacity for the visible tile.
          if (ts.id === selectedId) {
            map.setPaintProperty(ts.id, 'raster-opacity', 1);
          }
        });
      }
    }
  }, [map, selectedIndex, compareMode, selectedSpecialTileset, locations]);

  // --- useEffect to reset opacity when leaving compare mode ---
  useEffect(() => {
    if (map && !compareMode && selectedIndex !== null) {
      const currentAoi = locations[selectedIndex];
      if (currentAoi && currentAoi.isSpecial) {
        const selectedId = selectedSpecialTileset || currentAoi.tilesets[0].id;
        map.setPaintProperty(selectedId, 'raster-opacity', 1);
      }
    }
  }, [compareMode, map, selectedIndex, selectedSpecialTileset, locations]);

  // --- Navigation Mode Handlers ---
  const handleMenuClick = (menu) => {
    if (activeMenu === menu && !isExpanded) {
      setIsExpanded(true);
    } else {
      setActiveMenu(menu);
      setSelectedIndex(null);
      setSubPanelOpen(false);
      setIsExpanded(true);
    }
  };

  // The Back/Minimize button minimizes the panel.
  const handleMinimize = () => {
    setIsExpanded(false);
  };

  // --- AOI Selection Handler ---
  // Require a second click on the same AOI to open details.
  const handleLocationSelect = (idx, coords) => {
    if (selectedIndex === idx && !subPanelOpen) {
      setSubPanelOpen(true);
      onLocationSelect(coords);
    } else {
      setSelectedIndex(idx);
      setSubPanelOpen(false); // Do not open details immediately on new selection.
      onLocationSelect(coords);
      setSelectedSpecialTileset(null);
      setCompareMode(false);
    }
  };

  // Function to select a tileset within a special AOI group in normal (single-image) mode.
  const selectSpecialTileset = (specialGroup, selectedTilesetId) => {
    setSelectedSpecialTileset(selectedTilesetId);
    if (map) {
      specialGroup.tilesets.forEach((ts) => {
        map.setLayoutProperty(ts.id, 'visibility', ts.id === selectedTilesetId ? 'visible' : 'none');
        // If only one tile exists, enforce full opacity.
        if (specialGroup.tilesets.length === 1 && ts.id === selectedTilesetId) {
          map.setPaintProperty(ts.id, 'raster-opacity', 1);
        }
      });
    }
  };

  // --- Render Simple Content for Non-AOI Menus ---
  const renderSimpleContent = () => {
    switch (activeMenu) {
      case 'overview':
        return <Typography variant="body1">Areas of Interest: {locations.length}</Typography>;
      case 'highlights':
        return <Typography variant="body1">No highlights to show yet.</Typography>;
      case 'settings':
        return <Typography variant="body1">Settings content goes here.</Typography>;
      case 'help':
        return <Typography variant="body1">Help content goes here.</Typography>;
      case 'profile':
        return <Typography variant="body1">Profile content goes here.</Typography>;
      default:
        return <Typography variant="body1">Select a menu</Typography>;
    }
  };

  // --- Render AOI Content ---
  const renderAoiContent = () => {
    if (!subPanelOpen) {
      return (
        <List>
          {locations.map((loc, idx) => (
            <ListItemButton
              key={idx}
              selected={selectedIndex === idx}
              onClick={() => handleLocationSelect(idx, loc.coordinates)}
              sx={{
                backgroundColor: selectedIndex === idx ? 'rgba(0, 172, 193, 0.5)' : 'transparent',
                borderLeft: selectedIndex === idx ? '4px solid #00acc1' : 'none',
                '&:hover': {
                  backgroundColor:
                    selectedIndex === idx ? 'rgba(0, 172, 193, 0.5)' : 'rgba(0, 0, 0, 0.05)',
                },
              }}
            >
              <ListItemText
                primary={loc.name}
                secondary={
                  loc.isSpecial ? (
                    <Typography variant="caption" component="span" sx={{ color: '#777' }}>
                      {loc.tilesets.length} image{loc.tilesets.length > 1 ? 's' : ''}
                    </Typography>
                  ) : (
                    <Box>
                      <Typography variant="body2" sx={{ color: '#555' }}>
                        {loc.location}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#777' }}>
                        New events: {loc.newImagesCount}
                      </Typography>
                    </Box>
                  )
                }
                primaryTypographyProps={{ sx: { color: '#000' } }}
              />
            </ListItemButton>
          ))}
        </List>
      );
    } else {
      const currentAoi = locations[selectedIndex];
      if (!currentAoi) return null;
      if (currentAoi.isSpecial) {
        if (!compareMode) {
          // Normal single-image view with dropdown and a Compare button.
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
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <IconButton
                  onClick={() => {
                    setSubPanelOpen(false);
                    setSelectedIndex(null);
                    setSelectedSpecialTileset(null);
                    setCompareMode(false);
                  }}
                  sx={{ color: '#000' }}
                >
                  <ChevronLeftIcon />
                </IconButton>
                <Typography variant="h6" sx={{ color: '#000', ml: 1 }}>
                  {currentAoi.name} - Details
                </Typography>
              </Box>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="date-select-label">Select Date</InputLabel>
                <Select
                  labelId="date-select-label"
                  value={selectedId}
                  label="Select Date"
                  onChange={(e) => selectSpecialTileset(currentAoi, e.target.value)}
                >
                  {currentAoi.tilesets.map((ts) => (
                    <MenuItem key={ts.id} value={ts.id}>
                      {new Date(ts.date).toLocaleDateString()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {/* Details box without preview image */}
              <Box sx={{ p: 2, backgroundColor: '#eee', borderRadius: 1, mb: 2 }}>
                {currentAoi.tilesets
                  .filter((ts) => ts.id === selectedId)
                  .map((ts) => (
                    <Box key={ts.id}>
                      <Typography variant="h6" sx={{ color: '#000' }}>
                        {ts.name} - Details
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#555' }}>
                        <strong>Location:</strong> {ts.location}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#555' }}>
                        <strong>Date:</strong> {new Date(ts.date).toLocaleDateString()}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#555' }}>
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
                >
                  Compare Dates
                </Button>
              </Box>
            </Box>
          );
        } else {
          // Compare mode view.
          const leftImage = currentAoi.tilesets.find((ts) => ts.id === compareLeft) || currentAoi.tilesets[0];
          const rightImage = currentAoi.tilesets.find((ts) => ts.id === compareRight) || currentAoi.tilesets[0];
          if (map && leftImage && rightImage) {
            map.setLayoutProperty(leftImage.id, 'visibility', 'visible');
            map.setLayoutProperty(rightImage.id, 'visibility', 'visible');
          }
          return (
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <IconButton onClick={() => setCompareMode(false)} sx={{ color: '#000' }}>
                  <ChevronLeftIcon />
                </IconButton>
                <Typography variant="h6" sx={{ color: '#000', ml: 1 }}>
                  Back to Details
                </Typography>
              </Box>
              <Typography variant="h6" sx={{ color: '#000', mb: 2 }}>
                Compare Dates for {currentAoi.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <FormControl fullWidth>
                  <InputLabel id="left-date-select-label">Left Image</InputLabel>
                  <Select
                    labelId="left-date-select-label"
                    value={compareLeft || (currentAoi.tilesets[0] && currentAoi.tilesets[0].id)}
                    label="Left Image"
                    onChange={(e) => {
                      setCompareLeft(e.target.value);
                      if (map) {
                        map.setPaintProperty(e.target.value, 'raster-opacity', (100 - sliderValue) / 100);
                      }
                    }}
                  >
                    {currentAoi.tilesets.map((ts) => (
                      <MenuItem key={ts.id} value={ts.id}>
                        {new Date(ts.date).toLocaleDateString()}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel id="right-date-select-label">Right Image</InputLabel>
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
                />
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ color: '#555' }}>
                  <strong>Left Image Date:</strong>{' '}
                  {new Date(currentAoi.tilesets.find((ts) => ts.id === compareLeft)?.date).toLocaleDateString()}
                </Typography>
                <Typography variant="body2" sx={{ color: '#555' }}>
                  <strong>Right Image Date:</strong>{' '}
                  {new Date(currentAoi.tilesets.find((ts) => ts.id === compareRight)?.date).toLocaleDateString()}
                </Typography>
              </Box>
            </Box>
          );
        }
      } else {
        return (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <IconButton
                onClick={() => {
                  setSubPanelOpen(false);
                  setSelectedIndex(null);
                }}
                sx={{ color: '#000' }}
              >
                <ChevronLeftIcon />
              </IconButton>
              <Typography variant="h6" sx={{ color: '#000', ml: 1 }}>
                {currentAoi.name} - Details
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#555', mt: 1 }}>
              <strong>Location:</strong> {currentAoi.location}
            </Typography>
            <Typography variant="body2" sx={{ color: '#555' }}>
              <strong>New events:</strong> {currentAoi.newImagesCount}
            </Typography>
          </Box>
        );
      }
    }
  };

  // --- Render Expanded (Content) Mode view ---
  const renderContentMode = () => {
    const headerTitle =
      activeMenu === 'aoi'
        ? 'Areas of Interest'
        : activeMenu.charAt(0).toUpperCase() + activeMenu.slice(1);
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <img src="/images/spacelinelogoblack.png" alt="Logo" style={{ width: '280px' }} />
        </Box>
        {(activeMenu === 'overview' || activeMenu === 'profile') && (
          <>
            <Box sx={{ backgroundColor: '#444', color: '#fff', p: 2, borderRadius: 1, mb: 2 }}>
              <Typography variant="h6">{userInfo.name}</Typography>
              <Typography variant="body2">{userInfo.location}</Typography>
            </Box>
            <Divider sx={{ backgroundColor: '#777', mb: 2 }} />
          </>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, pl: 1 }}>
          <IconButton onClick={handleMinimize} sx={{ color: '#000' }}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            {headerTitle}
          </Typography>
        </Box>
        <Box sx={{ pl: 1, flexGrow: 1, overflowY: 'auto' }}>
          {activeMenu === 'aoi' ? renderAoiContent() : renderSimpleContent()}
        </Box>
      </Box>
    );
  };

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={true}
      sx={{
        width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
          boxSizing: 'border-box',
          backgroundColor: isExpanded ? '#f0f0f0' : '#ffffff',
          color: '#000',
          border: '1px solid #ccc',
          height: 'calc(100vh - 40px)',
          marginTop: '20px',
          marginBottom: '20px',
          marginLeft: '20px',
          borderRadius: '10px',
          p: 2,
          boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
        },
      }}
    >
      {isExpanded && activeMenu !== null ? (
        renderContentMode()
      ) : (
        // Navigation Mode: Icons only.
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pt: 2,
            height: '100%',
          }}
        >
          <Box sx={{ mb: 3 }}>
            <img src="/images/spacelinelogoblacksmall.png" alt="Logo" style={{ width: '40px' }} />
          </Box>
          <List sx={{ width: '100%' }}>
            <ListItemButton onClick={() => handleMenuClick('overview')} sx={{ justifyContent: 'center' }}>
              <DashboardIcon sx={{ color: activeMenu === 'overview' ? 'primary.main' : '#000' }} />
            </ListItemButton>
            <ListItemButton onClick={() => handleMenuClick('aoi')} sx={{ justifyContent: 'center' }}>
              <MapIcon sx={{ color: activeMenu === 'aoi' ? 'primary.main' : '#000' }} />
            </ListItemButton>
            <ListItemButton onClick={() => handleMenuClick('highlights')} sx={{ justifyContent: 'center' }}>
              <StarIcon sx={{ color: activeMenu === 'highlights' ? 'primary.main' : '#000' }} />
            </ListItemButton>
          </List>
          <Box sx={{ flexGrow: 1 }} />
          <List sx={{ width: '100%' }}>
            <ListItemButton onClick={() => handleMenuClick('settings')} sx={{ justifyContent: 'center' }}>
              <SettingsIcon sx={{ color: activeMenu === 'settings' ? 'primary.main' : '#000' }} />
            </ListItemButton>
            <ListItemButton onClick={() => handleMenuClick('help')} sx={{ justifyContent: 'center' }}>
              <HelpOutlineIcon sx={{ color: activeMenu === 'help' ? 'primary.main' : '#000' }} />
            </ListItemButton>
            <ListItemButton onClick={() => handleMenuClick('profile')} sx={{ justifyContent: 'center' }}>
              <AccountCircleIcon sx={{ color: activeMenu === 'profile' ? 'primary.main' : '#000' }} />
            </ListItemButton>
          </List>
        </Box>
      )}
    </Drawer>
  );
};

export default SidePanelComposite;
