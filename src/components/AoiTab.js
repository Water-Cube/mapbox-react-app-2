import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  CloudDownload as CloudDownloadIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';

const AoiPanel = ({
  map,
  locations,
  selectedIndex,
  subPanelOpen,
  onLocationSelect,
  onTilesetSelect,
  setSelectedIndex,
  setSubPanelOpen,
  aisMarkers,
  selectedVessel, // Received from props
  setSelectedVessel, // Setter from props
}) => {
  const [selectedSpecialTileset, setSelectedSpecialTileset] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    if (map && selectedIndex !== null) {
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
  }, [map, selectedIndex, selectedSpecialTileset, locations]);

  const handleLocationSelect = (idx, coords) => {
    const currentAoi = locations[idx];
    if (selectedIndex === idx && !subPanelOpen) {
      setSubPanelOpen(true);
      onLocationSelect(coords);
    } else {
      setSelectedIndex(idx);
      setSubPanelOpen(false);
      onLocationSelect(coords);
      setSelectedSpecialTileset(null);
      setSelectedDate('');
      setSelectedVessel(null); // Reset vessel selection
      if (currentAoi.isSpecial && currentAoi.tilesets.length > 0) {
        const latestTileset = currentAoi.tilesets[0];
        setSelectedSpecialTileset(latestTileset.id);
        setSelectedDate(formatDateTimeCET(latestTileset.dateCET).date);
        if (onTilesetSelect) {
          onTilesetSelect(latestTileset);
        }
        window.dispatchEvent(new CustomEvent('tilesetSelected', { detail: latestTileset }));
        if (map) {
          currentAoi.tilesets.forEach((ts) => {
            map.setLayoutProperty(ts.id, 'visibility', ts.id === latestTileset.id ? 'visible' : 'none');
            if (ts.id === latestTileset.id) {
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
    const time = cleanDateStr.split('T')[1].slice(0, 5);
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
  };

  const renderAoiContent = () => {
    if (!subPanelOpen && !selectedVessel) {
      // Main AOI List
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
               minHeight: '60px', // Taller buttons
               py: 2, // Vertical padding for height
               backgroundImage: `url('/images/placeholder.png')`, // Static image
               backgroundSize: 'cover',
               backgroundPosition: 'center',
               backgroundColor: 'rgba(255, 255, 255, 0.1)', // Base overlay
               transition: 'background-color 0.2s ease, transform 0.2s ease', // Smooth transition
               '&:hover': {
                 backgroundColor: 'rgba(255, 255, 255, 0.15)', // Subtle overlay change
                 transform: 'scale(1.02)', // Slight zoom (2% scale increase)
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
            ))}
          </List>
        </Box>
      );
    } else if (subPanelOpen && !selectedVessel) {
      // AOI Details Subpanel
      const currentAoi = locations[selectedIndex];
      if (!currentAoi) return null;

      if (currentAoi.isSpecial) {
        const selectedId = selectedSpecialTileset || currentAoi.tilesets[0].id;
        if (!selectedSpecialTileset) {
          const firstTileset = currentAoi.tilesets[0];
          const { date } = formatDateTimeCET(firstTileset.dateCET);
          setSelectedSpecialTileset(firstTileset.id);
          setSelectedDate(date);
          if (onTilesetSelect) {
            onTilesetSelect(firstTileset);
          }
          window.dispatchEvent(new CustomEvent('tilesetSelected', { detail: firstTileset }));
          if (map) {
            currentAoi.tilesets.forEach((ts) => {
              map.setLayoutProperty(ts.id, 'visibility', ts.id === firstTileset.id ? 'visible' : 'none');
              if (currentAoi.tilesets.length === 1 && ts.id === firstTileset.id) {
                map.setPaintProperty(ts.id, 'raster-opacity', 1);
              }
            });
          }
        }

        const tilesetsByDate = currentAoi.tilesets.reduce((acc, ts) => {
          const { date } = formatDateTimeCET(ts.dateCET);
          if (!acc[date]) {
            acc[date] = [];
          }
          acc[date].push(ts);
          return acc;
        }, {});

        const tilesetsForSelectedDate = tilesetsByDate[selectedDate] || currentAoi.tilesets;

        const selectedTileset = currentAoi.tilesets.find((ts) => ts.id === selectedId);
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
          <Box sx={{ p: 2, color: '#fff' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <IconButton
                onClick={() => {
                  setSubPanelOpen(false);
                  setSelectedIndex(null);
                  setSelectedSpecialTileset(null);
                  setSelectedDate('');
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
                value={selectedDate}
                label="Select Date"
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  const firstTileset = tilesetsByDate[e.target.value][0];
                  selectSpecialTileset(currentAoi, firstTileset.id);
                }}
                sx={{
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                }}
              >
                {Object.keys(tilesetsByDate).map((dateStr) => (
                  <MenuItem key={dateStr} value={dateStr}>
                    {dateStr}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {tilesetsForSelectedDate.length > 1 && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="time-select-label" sx={{ color: '#fff' }}>
                  Select Time (CET)
                </InputLabel>
                <Select
                  variant="outlined"
                  labelId="time-select-label"
                  value={selectedId}
                  label="Select Time (CET)"
                  onChange={(e) => selectSpecialTileset(currentAoi, e.target.value)}
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                  }}
                >
                  <MenuItem key="none" value="none">
                    None
                  </MenuItem>
                  {tilesetsForSelectedDate.map((ts) => {
                    const { time } = formatDateTimeCET(ts.dateCET);
                    return (
                      <MenuItem key={ts.id} value={ts.id}>
                        {time} - {ts.name}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            )}
            <Box sx={{ p: 2, backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 1, mb: 2 }}>
              {currentAoi.tilesets
                .filter((ts) => ts.id === selectedId)
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
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          p: 2,
                          mb: 1,
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                          cursor: 'pointer',
                          '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)' },
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
                          <strong>Course:</strong> {props.cog}°
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#ccc' }}>
                          <strong>Timestamp:</strong> {props.timestamp}
                        </Typography>
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
                    );
                  })}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: '#ccc', fontStyle: 'italic' }}>
                  No other ships in the dataset.
                </Typography>
              )}
            </Box>
          </Box>
        );
      } else {
        return (
          <Box sx={{ p: 2, color: '#fff' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <IconButton
                onClick={() => {
                  setSubPanelOpen(false);
                  setSelectedIndex(null);
                  setSelectedDate('');
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
    } else if (selectedVessel) {
      // Vessel Details View
      const props = selectedVessel.properties;
      return (
        <Box sx={{ p: 2, color: '#fff' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <IconButton
              onClick={() => setSelectedVessel(null)}
              sx={{ color: '#fff' }}
            >
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="h5" sx={{ ml: 1, fontWeight: 'bold' }}>
              {props.name || 'Unknown Vessel'} - Details
            </Typography>
          </Box>
          <Box
            component="img"
            src="/images/placeholdervessel.jpg"
            alt="Vessel"
            sx={{
              width: '100%',
              height: '200px',
              objectFit: 'cover',
              borderRadius: '8px',
              mb: 2,
            }}
          />
          <Box sx={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px', p: 2 }}>
            <Typography variant="body1" sx={{ color: '#fff', mb: 1 }}>
              <strong>MMSI:</strong> {props.mmsi}
            </Typography>
            <Typography variant="body1" sx={{ color: '#fff', mb: 1 }}>
              <strong>Type:</strong> {props.shipType || 'N/A'}
            </Typography>
            <Typography variant="body1" sx={{ color: '#fff', mb: 1 }}>
              <strong>Speed:</strong> {props.sog} knots
            </Typography>
            <Typography variant="body1" sx={{ color: '#fff', mb: 1 }}>
              <strong>Course:</strong> {props.cog}°
            </Typography>
            <Typography variant="body1" sx={{ color: '#fff', mb: 1 }}>
              <strong>Timestamp:</strong> {props.timestamp}
            </Typography>
          </Box>
        </Box>
      );
    }
  };

  return renderAoiContent();
};

export default AoiPanel;