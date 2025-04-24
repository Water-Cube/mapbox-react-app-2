import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  List,
  ListItemButton,
  Typography,
  Button,
  FormControlLabel,
  Switch,
  Divider,
  Link,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Map as MapIcon,
  Star as StarIcon,
  Settings as SettingsIcon,
  HelpOutline as HelpOutlineIcon,
  AccountCircle as AccountCircleIcon,
  Email as EmailIcon,
  Description as DescriptionIcon,
  QuestionAnswer as QuestionAnswerIcon,
  Support as SupportIcon,
  DirectionsBoat as DirectionsBoatIcon,
} from '@mui/icons-material';
import AoiPanel from './AoiTab';
import AISLive from './AISLive';

const TOTAL_PANEL_WIDTH = 340;
const ICON_COLUMN_WIDTH = 55;
const MAPBOX_ACCESS_TOKEN =
  'sk.eyJ1Ijoic2ltb252cCIsImEiOiJjbTZzczM1Y3kwOHJrMmpzZjFlNXUwOWNtIn0.449LWA2pOpadwlMduS9TJA';

function calculateCenterFromBounds(bounds) {
  const [minLng, minLat, maxLng, maxLat] = bounds;
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

function isPointInBounds([lng, lat], [minLng, minLat, maxLng, maxLat]) {
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

const SidePanelComposite = ({ 
  onLocationSelect, 
  userId, 
  map, 
  onTilesetSelect, 
  showPaths, 
  togglePaths, 
  isAisEnabled, 
  toggleAisTracking,
  aisLoading = false,
}) => {
  const [activeMenu, setActiveMenu] = useState('overview');
  const [locations, setLocations] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [subPanelOpen, setSubPanelOpen] = useState(false);
  const [settings, setSettings] = useState({
    ais: false,
    paths: false,
    vessels: false,
  });
  const [aisMarkers, setAisMarkers] = useState({ active: [], all: [] });
  const [selectedVessel, setSelectedVessel] = useState(null);
  const [allVisibleVessels, setAllVisibleVessels] = useState([]);
  const [selectedVesselSource, setSelectedVesselSource] = useState(null);
  const [userFullName, setUserFullName] = useState('');

  useEffect(() => {
    const userFile = `/data/users/${userId}.json`;
    fetch(userFile)
      .then((res) => res.json())
      .then((data) => {
        const normalLocations = [];
        const tilesets = data.tilesets || [];
        setUserFullName(data.full_name || 'User');
        Promise.all(
          tilesets.map(async (ts) => {
            const imageDateCET = ts.date.replace(/Z|[+-]\d{2}:\d{2}$/, '');
            let coords = null;
            let bounds = null;
            try {
              const response = await fetch(
                `https://api.mapbox.com/tilesets/v1/simonvp.${ts.id}?access_token=${MAPBOX_ACCESS_TOKEN}`
              );
              const metadata = await response.json();
              if (metadata && metadata.bounds) {
                bounds = metadata.bounds;
                coords = calculateCenterFromBounds(metadata.bounds);
              }
            } catch (error) {
              console.warn(`Failed to fetch metadata for tileset ${ts.id}:`, error);
            }
            if (!coords) coords = [0, 0];
            if (!bounds) bounds = [0, 0, 0, 0];
            const previewUrl = ts.name === 'Area 2' ? '/data/thumbnail2.png' : '/data/thumbnail1.png';
            return {
              id: ts.id,
              name: ts.name,
              location: ts.location,
              coordinates: coords,
              bounds,
              newImagesCount: 'N/A',
              isSpecial: true,
              url: ts.url,
              date: imageDateCET,
              dateCET: imageDateCET,
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
                bounds: ts.bounds,
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
      .catch(console.error);
  }, [userId]);

  useEffect(() => {
    const handleAisMarkersUpdated = (event) => {
      const { active = [], all = [] } = event.detail || {};
      // Set to false to disable console logs
      const DEBUG_MODE = false;
      
      if (DEBUG_MODE) {
        console.log('AIS Markers Updated - Active:', active.length, 'All:', all.length);
      }

      const uniqueVesselsMap = new Map();
      all.forEach((vessel) => {
        const mmsi = vessel.properties.mmsi;
        if (!uniqueVesselsMap.has(mmsi)) {
          uniqueVesselsMap.set(mmsi, vessel);
        } else {
          const existing = uniqueVesselsMap.get(mmsi);
          if (new Date(vessel.properties.timestamp) > new Date(existing.properties.timestamp)) {
            uniqueVesselsMap.set(mmsi, vessel);
          }
        }
      });
      const uniqueVessels = Array.from(uniqueVesselsMap.values());
      
      if (DEBUG_MODE) {
        console.log('Unique vessels by MMSI:', uniqueVessels.length);
      }

      if (allVisibleVessels.length === 0) {
        const visibleVessels = uniqueVessels.filter((vessel) => {
          if (!vessel.geometry || !vessel.geometry.coordinates) {
            console.warn('Vessel missing coordinates:', vessel);
            return false;
          }
          const [lng, lat] = vessel.geometry.coordinates;
          return locations.some((loc) =>
            loc.tilesets.some((ts) => isPointInBounds([lng, lat], ts.bounds))
          );
        });
        
        if (DEBUG_MODE) {
          console.log('Visible unique vessels:', visibleVessels.length);
        }
        
        setAllVisibleVessels(visibleVessels);
      }

      setAisMarkers({ active, all });
    };

    const handleVesselSelected = (event) => {
      const vessel = event.detail;
      setSelectedVessel(vessel);
      setActiveMenu('aoi');
      setSubPanelOpen(true);
      setSelectedVesselSource(activeMenu);
      
      // Set to false to disable console logs
      const DEBUG_MODE = false;
      if (DEBUG_MODE) {
        console.log('Vessel selected in SidePanel:', vessel?.properties.mmsi);
      }
    };

    window.addEventListener('aisMarkersUpdated', handleAisMarkersUpdated);
    window.addEventListener('vesselSelected', handleVesselSelected);

    return () => {
      window.removeEventListener('aisMarkersUpdated', handleAisMarkersUpdated);
      window.removeEventListener('vesselSelected', handleVesselSelected);
    };
  }, [locations, allVisibleVessels.length, activeMenu]);

  const handleMenuClick = (menu) => {
    setActiveMenu(menu);
    // Preserve all state when switching tabs
    // No state resets at all
  };

  const handleSettingsChange = (event) => {
    const { name, checked } = event.target;
    setSettings((prevSettings) => ({
      ...prevSettings,
      [name]: checked,
    }));
    
    // If this is the AIS toggle, update the isAisEnabled state
    if (name === 'ais') {
      toggleAisTracking(checked);
    }
  };

  const handleVesselClick = (feature) => {
    setSelectedVessel(feature);
    setActiveMenu('aoi');
    setSubPanelOpen(true);
    setSelectedVesselSource(activeMenu);
  };

  const renderSimpleContent = () => {
    switch (activeMenu) {
      case 'overview':
        return (
          <Box sx={{ p: 2, color: '#fff' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                Overview
              </Typography>
            </Box>
            <Typography variant="subtitle1" sx={{ mb: 2, color: '#ccc' }}>
              Welcome, {userFullName}!
            </Typography>

            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 2,
                mb: 3,
                justifyContent: 'space-between',
              }}
            >
              <Box
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  p: 1.5,
                  flex: '1 1 45%',
                  textAlign: 'center',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                }}
              >
                <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold' }}>
                  {locations.length}
                </Typography>
                <Typography variant="body2" sx={{ color: '#ccc' }}>
                  Areas of Interest
                </Typography>
              </Box>
              <Box
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  p: 1.5,
                  flex: '1 1 45%',
                  textAlign: 'center',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                }}
              >
                <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold' }}>
                  {allVisibleVessels.length}
                </Typography>
                <Typography variant="body2" sx={{ color: '#ccc' }}>
                  Vessels
                </Typography>
              </Box>
              <Box
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  p: 1.5,
                  flex: '1 1 45%',
                  textAlign: 'center',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                }}
              >
                <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold' }}>
                  {locations.reduce((sum, loc) => sum + (loc.newEvents || 0), 0)}
                </Typography>
                <Typography variant="body2" sx={{ color: '#ccc' }}>
                  Recent Events
                </Typography>
              </Box>
              <Box
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  p: 1.5,
                  flex: '1 1 45%',
                  textAlign: 'center',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                }}
              >
                <Typography variant="body1" sx={{ color: '#fff', fontWeight: 'bold' }}>
                  {aisMarkers.active.length}
                </Typography>
                <Typography variant="body2" sx={{ color: '#ccc' }}>
                  Active AIS Markers
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                maxHeight: 'calc(100vh - 300px)',
                overflowY: 'auto',
                pr: 1,
                '&::-webkit-scrollbar': { width: '8px' },
                '&::-webkit-scrollbar-thumb': { backgroundColor: '#555', borderRadius: '4px' },
                '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0, 0, 0, 0.2)' },
              }}
            >
              {allVisibleVessels.length > 0 && (
                <>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold', mb: 1 }}>
                    Vessels ({allVisibleVessels.length})
                  </Typography>
                  {allVisibleVessels.map((feature, index) => {
                    const props = feature.properties;
                    return (
                      <Box
                        key={props.mmsi || index}
                        sx={{
                          backgroundColor: 'rgba(0, 255, 0, 0.1)',
                          borderRadius: '8px',
                          p: 2,
                          mb: 1,
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)',
                            cursor: 'pointer',
                          },
                        }}
                        onClick={() => {
                          handleVesselClick(feature);
                        }}
                      >
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
                          <strong>Timestamp:</strong> {props.timestamp}
                        </Typography>
                      </Box>
                    );
                  })}
                </>
              )}

              {allVisibleVessels.length === 0 && (
                <Typography variant="body2" sx={{ color: '#ccc', fontStyle: 'italic' }}>
                  No vessels detected at this time.
                </Typography>
              )}
            </Box>
          </Box>
        );
      case 'ais-live':
        return (
          <AISLive 
            isAisEnabled={isAisEnabled} 
            toggleAisTracking={toggleAisTracking}
            isLoading={aisLoading} 
          />
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
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
              Settings
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 'medium', mb: 1 }}>
                Features
              </Typography>
              <FormControlLabel
                control={<Switch checked={settings.ais} onChange={handleSettingsChange} name="ais" disabled />}
                label={<Typography sx={{ color: '#fff' }}>AIS Tracking (Premium)</Typography>}
              />
              <FormControlLabel
                control={<Switch checked={settings.paths} onChange={handleSettingsChange} name="paths" disabled />}
                label={<Typography sx={{ color: '#fff' }}>Paths Tracking (Premium)</Typography>}
              />
              <FormControlLabel
                control={<Switch checked={settings.vessels} onChange={handleSettingsChange} name="vessels" disabled />}
                label={<Typography sx={{ color: '#fff' }}>Vessels Tracking (Premium)</Typography>}
              />
              <Divider sx={{ my: 2, backgroundColor: '#444' }} />
              <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 'medium', mb: 1 }}>
                Preferences
              </Typography>
              <FormControlLabel
                control={<Switch checked={settings.notifications} onChange={handleSettingsChange} name="notifications" />}
                label={<Typography sx={{ color: '#fff' }}>Enable Notifications</Typography>}
              />
              <FormControlLabel
                control={<Switch checked={settings.autoRefresh} onChange={handleSettingsChange} name="autoRefresh" disabled />}
                label={<Typography sx={{ color: '#fff' }}>Auto-Refresh (Premium)</Typography>}
              />
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ color: '#ccc', fontStyle: 'italic' }}>
                  Upgrade to Premium for advanced features.
                </Typography>
                <Button
                  variant="outlined"
                  sx={{ mt: 1, color: '#fff', borderColor: '#fff', '&:hover': { borderColor: '#ccc' } }}
                >
                  Upgrade Plan
                </Button>
              </Box>
            </Box>
          </Box>
        );
      case 'help':
        return (
          <Box sx={{ p: 2, color: '#fff', width: TOTAL_PANEL_WIDTH - ICON_COLUMN_WIDTH - 16 }}>
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
              Help & Support
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 'medium' }}>
                Contact Spaceline Labs
              </Typography>
              <List dense sx={{ p: 0 }}>
                <ListItemButton sx={{ py: 0.5 }}>
                  <EmailIcon sx={{ color: '#fff', mr: 1 }} />
                  <Typography>
                    <Link href="mailto:support@spacelinelabs.com" sx={{ color: '#fff', textDecoration: 'underline' }}>
                      support@spacelinelabs.com
                    </Link>
                  </Typography>
                </ListItemButton>
              </List>
              <Divider sx={{ my: 1, backgroundColor: '#444' }} />
              <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 'medium' }}>
                Support Resources
              </Typography>
              <List dense sx={{ p: 0 }}>
                <ListItemButton sx={{ py: 0.5 }}>
                  <DescriptionIcon sx={{ color: '#fff', mr: 1 }} />
                  <Typography>
                    <Link href="https://spacelinelabs.com/docs" target="_blank" sx={{ color: '#fff', textDecoration: 'underline' }}>
                      User Guide
                    </Link>
                  </Typography>
                </ListItemButton>
                <ListItemButton sx={{ py: 0.5 }}>
                  <QuestionAnswerIcon sx={{ color: '#fff', mr: 1 }} />
                  <Typography>
                    <Link href="https://spacelinelabs.com/faq" target="_blank" sx={{ color: '#fff', textDecoration: 'underline' }}>
                      FAQs
                    </Link>
                  </Typography>
                </ListItemButton>
                <ListItemButton sx={{ py: 0.5 }}>
                  <SupportIcon sx={{ color: '#fff', mr: 1 }} />
                  <Typography>
                    <Link href="https://spacelinelabs.com/support" target="_blank" sx={{ color: '#fff', textDecoration: 'underline' }}>
                      Contact Support
                    </Link>
                  </Typography>
                </ListItemButton>
              </List>
              <Divider sx={{ my: 1, backgroundColor: '#444' }} />
              <Typography variant="body2" sx={{ color: '#ccc', wordWrap: 'break-word' }}>
                <strong>About Spaceline Labs:</strong> We simplify complex data into actionable insights using advanced algorithms and real-time processing.
              </Typography>
            </Box>
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

  const renderActiveContent = () => {
    // Always render the AoiPanel component, but hide it when not active
    return (
      <>
        <Box sx={{ display: activeMenu === 'aoi' ? 'block' : 'none' }}>
          <AoiPanel
            map={map}
            locations={locations}
            selectedIndex={selectedIndex}
            subPanelOpen={subPanelOpen}
            onLocationSelect={onLocationSelect}
            onTilesetSelect={onTilesetSelect}
            setSelectedIndex={setSelectedIndex}
            setSubPanelOpen={(open) => setSubPanelOpen(open)}
            aisMarkers={aisMarkers}
            selectedVessel={selectedVessel}
            setSelectedVessel={setSelectedVessel}
            showPaths={showPaths}
            togglePaths={togglePaths}
            setActiveMenu={setActiveMenu}
            selectedVesselSource={selectedVesselSource}
            setSelectedVesselSource={setSelectedVesselSource}
          />
        </Box>
        <Box sx={{ display: activeMenu !== 'aoi' ? 'block' : 'none' }}>
          {renderSimpleContent()}
        </Box>
      </>
    );
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
          backgroundColor: 'transparent',
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
      <Box
        sx={{
          width: ICON_COLUMN_WIDTH,
          backgroundColor: '#222',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          borderRight: '1px solid #444',
          py: 2,
        }}
      >
        <Box sx={{ mb: 3 }}>
          <img src="/images/spacelinelogowhitesmall.png" alt="Logo" style={{ width: '30px', height: 'auto' }} />
        </Box>
        <List>
          <ListItemButton onClick={() => handleMenuClick('overview')} sx={{ justifyContent: 'center', mb: 1 }}>
            <DashboardIcon sx={{ color: activeMenu === 'overview' ? 'primary.main' : '#fff' }} />
          </ListItemButton>
          <ListItemButton onClick={() => handleMenuClick('aoi')} sx={{ justifyContent: 'center', mb: 1 }}>
            <MapIcon sx={{ color: activeMenu === 'aoi' ? 'primary.main' : '#fff' }} />
          </ListItemButton>
          <ListItemButton onClick={() => handleMenuClick('ais-live')} sx={{ justifyContent: 'center', mb: 1 }}>
            <DirectionsBoatIcon sx={{ color: activeMenu === 'ais-live' ? 'primary.main' : '#fff' }} />
          </ListItemButton>
          <ListItemButton onClick={() => handleMenuClick('highlights')} sx={{ justifyContent: 'center', mb: 1 }}>
            <StarIcon sx={{ color: activeMenu === 'highlights' ? 'primary.main' : '#fff' }} />
          </ListItemButton>
        </List>
        <Box sx={{ flexGrow: 1 }} />
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
      <Box
        sx={{
          width: TOTAL_PANEL_WIDTH - ICON_COLUMN_WIDTH,
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